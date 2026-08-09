import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { pathToFileURL } from "node:url";

import { loadMasterySnapshotWithRepository } from "../src/features/mastery/utils/load-mastery-snapshot";
import type { CardReviewEventRow } from "../src/features/mastery/types/mastery-types";
import { findDueCandidates } from "../src/features/spaced-repetition/server/due-repository";
import { SCHEDULABLE_EVENT_OR_PREDICATE } from "../src/features/spaced-repetition/types/spaced-repetition-types";
import {
  runProductionComparison,
  type ProductionCompareDataAccess,
  type ProductionComparisonResult,
} from "../src/features/spaced-repetition/utils/run-production-comparison";
import type { Database } from "../src/lib/supabase/types";

import {
  ALLOWED_PRODUCTION_PROJECT_REFS,
  resolveProductionIdentity,
} from "./lib/production-identity";
export {
  ALLOWED_PRODUCTION_PROJECT_REFS,
  resolveProductionIdentity,
  validateProductionIdentity,
  type ProductionIdentity,
} from "./lib/production-identity";

type Supabase = SupabaseClient<Database>;

const SCOPE_ID_PAGE_SIZE = 1000;

// Read-only data access built on the same hardened production identity guard
// as the reconciliation runner. No write-capable repository is imported here.
async function buildDataAccess(client: Supabase): Promise<ProductionCompareDataAccess> {
  const findActiveCardIdsInScope = async (userId: string): Promise<string[]> => {
    const ids: string[] = [];
    let start = 0;
    while (true) {
      const { data } = await client
        .from("flashcards")
        .select("id")
        .eq("user_id", userId)
        .order("id", { ascending: true })
        .range(start, start + SCOPE_ID_PAGE_SIZE - 1);
      const page = data ?? [];
      ids.push(...page.map((row) => row.id));
      if (page.length < SCOPE_ID_PAGE_SIZE) return ids;
      start += SCOPE_ID_PAGE_SIZE;
    }
  };

  const findActiveCardIds = async (cardIds: readonly string[]): Promise<string[]> => {
    const { data } = await client
      .from("flashcards")
      .select("id")
      .in("id", [...cardIds]);
    return (data ?? []).map((row) => row.id);
  };

  const findReviewEvents = async (cardIds: readonly string[]): Promise<CardReviewEventRow[]> => {
    const events: CardReviewEventRow[] = [];
    let start = 0;
    while (true) {
      const { data } = await client
        .from("card_review_events")
        .select("flashcard_id, is_correct, reviewed_at")
        .in("flashcard_id", [...cardIds])
        .order("reviewed_at", { ascending: true })
        .range(start, start + SCOPE_ID_PAGE_SIZE - 1);
      const page = data ?? [];
      events.push(
        ...page.map((event) => ({
          flashcardId: event.flashcard_id,
          isCorrect: event.is_correct,
          reviewedAt: event.reviewed_at,
        })),
      );
      if (page.length < SCOPE_ID_PAGE_SIZE) return events;
      start += SCOPE_ID_PAGE_SIZE;
    }
  };

  const loadMasteryReviewCardIds = async (
    userId: string,
    evaluationTime: string,
  ): Promise<string[]> => {
    const snapshot = await loadMasterySnapshotWithRepository(
      {
        findActiveCardIdsInScope: () => findActiveCardIdsInScope(userId),
        findActiveCardIds,
        findReviewEvents,
      },
      evaluationTime,
      undefined,
    );
    return snapshot.reviewCandidates.candidates.map((candidate) => candidate.flashcardId);
  };

  const loadUsersWithHistory = async (): Promise<string[]> => {
    const userIds = new Set<string>();
    let start = 0;
    while (true) {
      const { data } = await client
        .from("card_review_events")
        .select("user_id")
        .or(SCHEDULABLE_EVENT_OR_PREDICATE)
        .range(start, start + SCOPE_ID_PAGE_SIZE - 1);
      const page = data ?? [];
      for (const row of page) userIds.add(row.user_id);
      if (page.length < SCOPE_ID_PAGE_SIZE) break;
      start += SCOPE_ID_PAGE_SIZE;
    }
    return Array.from(userIds).sort();
  };

  return {
    loadUsersWithHistory,
    loadMasteryReviewCardIds,
    loadFsrsDueCardIds: (userId, evaluationTime) =>
      findDueCandidates(client, userId, { type: "library" }, evaluationTime).then((candidates) =>
        candidates.map((candidate) => candidate.flashcardId),
      ),
  };
}

function formatResult(projectRef: string, result: ProductionComparisonResult): string {
  const lines = [
    "FSRS PRODUCTION READ-ONLY COMPARISON",
    "",
    `Project: ${projectRef}`,
    `Evaluation time (UTC): ${result.evaluationTime}`,
    `Users compared: ${result.aggregate.usersCompared}`,
    "",
    "Per-user (identity hidden, counts only):",
  ];

  for (const row of result.perUser) {
    lines.push(
      `  ${row.label}:`,
      `    Mastery review count: ${row.comparison.masteryReviewCount}`,
      `    FSRS due count:       ${row.comparison.fsrsDueCount}`,
      `    In both:              ${row.comparison.inBoth}`,
      `    Mastery only:         ${row.comparison.masteryOnly}`,
      `    FSRS only:            ${row.comparison.fsrsOnly}`,
    );
  }

  const aggregate = result.aggregate;
  lines.push(
    "",
    "Aggregate:",
    `  Mastery review candidates: ${aggregate.masteryReviewCandidates}`,
    `  FSRS due candidates:       ${aggregate.fsrsDueCandidates}`,
    `  In both:                   ${aggregate.inBoth}`,
    `  Mastery only:              ${aggregate.masteryOnly}`,
    `  FSRS only:                 ${aggregate.fsrsOnly}`,
  );

  const sanity = result.sanity;
  lines.push(
    "",
    "Sanity metrics:",
    `  Users with Mastery=0 but FSRS>0: ${sanity.usersWithMasteryZeroFsrsPositive}`,
    `  Users with FSRS=0 but Mastery>0: ${sanity.usersWithFsrsZeroMasteryPositive}`,
    `  Users with identical sets:       ${sanity.usersWithIdenticalSets}`,
    `  Max absolute count difference:   ${sanity.maxAbsoluteCountDifference}`,
    "",
    "READ-ONLY — NO WRITES PERFORMED",
  );

  return lines.join("\n");
}

async function main(): Promise<void> {
  const identity = resolveProductionIdentity(process.env, ALLOWED_PRODUCTION_PROJECT_REFS);

  // One fixed UTC instant for the entire run; profile timezone never affects
  // eligibility, so it is not consulted here.
  const evaluationTime = new Date().toISOString();

  const client = createClient<Database>(identity.url, identity.serviceRoleKey);
  const data = await buildDataAccess(client);
  const result = await runProductionComparison(data, evaluationTime);

  console.log(formatResult(identity.projectRef, result));
}

function isDirectExecution(): boolean {
  if (!process.argv[1]) return false;
  return (
    process.argv[1] === import.meta.url || pathToFileURL(process.argv[1]).href === import.meta.url
  );
}

if (isDirectExecution()) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
