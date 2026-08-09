import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { loadMasterySnapshotWithRepository } from "../src/features/mastery/utils/load-mastery-snapshot";
import {
  findDueCandidates,
  countDueCards,
} from "../src/features/spaced-repetition/server/due-repository";
import { compareReviewSources } from "../src/features/spaced-repetition/utils/compare-review-sources";
import type { CardReviewEventRow } from "../src/features/mastery/types/mastery-types";
import type { Database } from "../src/lib/supabase/types";
import { resolveLocalSupabaseEnv } from "./lib/local-supabase-env.mjs";

// Local-only safety: reuse the established local-endpoint guard. The runner
// refuses production/non-local Supabase URLs before touching anything.
const npmCliPath = process.env.npm_execpath;
if (!npmCliPath) throw new Error("npm_execpath is required; run via npm script.");

type Supabase = SupabaseClient<Database>;

const SCHEDULABLE_OR = "and(fsrs_rating.gte.1,fsrs_rating.lte.4),is_correct.not.is.null";

async function resolveClient(): Promise<Supabase> {
  const env = await resolveLocalSupabaseEnv(npmCliPath);
  const client = createClient<Database>(env.supabaseUrl, env.serviceRoleKey);
  return client;
}

async function findActiveCardIds(client: Supabase, cardIds: readonly string[]): Promise<string[]> {
  const { data } = await client
    .from("flashcards")
    .select("id")
    .in("id", [...cardIds]);
  return (data ?? []).map((card) => card.id);
}

async function findReviewEvents(
  client: Supabase,
  cardIds: readonly string[],
): Promise<CardReviewEventRow[]> {
  const events: CardReviewEventRow[] = [];
  let start = 0;
  while (true) {
    const { data } = await client
      .from("card_review_events")
      .select("flashcard_id, is_correct, reviewed_at")
      .in("flashcard_id", [...cardIds])
      .order("reviewed_at", { ascending: true })
      .range(start, start + 1000 - 1);
    const page = data ?? [];
    events.push(
      ...page.map((event) => ({
        flashcardId: event.flashcard_id,
        isCorrect: event.is_correct,
        reviewedAt: event.reviewed_at,
      })),
    );
    if (page.length < 1000) return events;
    start += 1000;
  }
}

async function loadUsersWithHistory(client: Supabase): Promise<string[]> {
  const { data } = await client
    .from("card_review_events")
    .select("user_id")
    .or(SCHEDULABLE_OR)
    .order("user_id", { ascending: true });
  const ids = new Set<string>();
  for (const row of data ?? []) {
    ids.add(row.user_id);
  }
  return Array.from(ids);
}

async function loadMasteryReviewCardIds(
  client: Supabase,
  userId: string,
  evaluationTime: string,
): Promise<string[]> {
  const snapshot = await loadMasterySnapshotWithRepository(
    {
      findActiveCardIdsInScope: async () => {
        const ids: string[] = [];
        let start = 0;
        while (true) {
          const { data } = await client
            .from("flashcards")
            .select("id")
            .eq("user_id", userId)
            .order("id", { ascending: true })
            .range(start, start + 1000 - 1);
          const page = data ?? [];
          ids.push(...page.map((row) => row.id));
          if (page.length < 1000) return ids;
          start += 1000;
        }
      },
      findActiveCardIds: (cardIds) => findActiveCardIds(client, cardIds),
      findReviewEvents: (cardIds) => findReviewEvents(client, cardIds),
    },
    evaluationTime,
    undefined,
  );
  return snapshot.reviewCandidates.candidates.map((candidate) => candidate.flashcardId);
}

async function main(): Promise<void> {
  console.log("Verifying local Supabase...");
  const client = await resolveClient();
  console.log("Connected.");

  const evaluationTime = new Date().toISOString();
  const users = await loadUsersWithHistory(client);
  console.log(`Found ${users.length} user(s) with schedulable history.\n`);

  for (const userId of users) {
    const [masteryCardIds, fsrsDueCount, fsrsDueCandidates] = await Promise.all([
      loadMasteryReviewCardIds(client, userId, evaluationTime),
      countDueCards(client, userId, { type: "library" }, evaluationTime),
      findDueCandidates(client, userId, { type: "library" }, evaluationTime),
    ]);

    const fsrsCardIds = fsrsDueCandidates.map((candidate) => candidate.flashcardId);
    const comparison = compareReviewSources(masteryCardIds, fsrsCardIds);

    console.log(`User: ${userId}`);
    console.log(`  Mastery review count: ${comparison.masteryReviewCount}`);
    console.log(`  FSRS due count:       ${comparison.fsrsDueCount}`);
    console.log(`  In both:              ${comparison.inBoth}`);
    console.log(`  Mastery only:         ${comparison.masteryOnly}`);
    console.log(`  FSRS only:            ${comparison.fsrsOnly}`);
    console.log(
      `  Top FSRS due candidates (count only): ${fsrsDueCandidates.length} / total ${fsrsDueCount}`,
    );
    console.log("");
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
