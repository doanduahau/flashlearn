import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { pathToFileURL } from "node:url";

import { loadMasterySnapshotWithRepository } from "../src/features/mastery/utils/load-mastery-snapshot";
import type { CardReviewEventRow } from "../src/features/mastery/types/mastery-types";
import { findDueCandidates } from "../src/features/spaced-repetition/server/due-repository";
import { SCHEDULABLE_EVENT_OR_PREDICATE } from "../src/features/spaced-repetition/types/spaced-repetition-types";
import {
  runProductionDiagnostic,
  runMissingCardTrace,
  type ProductionDiagnosticDataAccess,
  type ProductionDiagnosticResult,
  type TraceMissingReport,
} from "../src/features/spaced-repetition/utils/run-production-diagnostic";
import type { FsrsOnlyCardDetail } from "../src/features/spaced-repetition/utils/diagnose-due-divergence";
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

async function buildDataAccess(client: Supabase): Promise<ProductionDiagnosticDataAccess> {
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
      ids.push(...page.map((row: { id: string }) => row.id));
      if (page.length < SCOPE_ID_PAGE_SIZE) return ids;
      start += SCOPE_ID_PAGE_SIZE;
    }
  };

  const findActiveCardIds = async (cardIds: readonly string[]): Promise<string[]> => {
    const results: string[] = [];
    const uniqueIds = [...new Set(cardIds)];
    for (let batch = 0; batch < uniqueIds.length; batch += SCOPE_ID_PAGE_SIZE) {
      const batchIds = uniqueIds.slice(batch, batch + SCOPE_ID_PAGE_SIZE);
      let start = 0;
      while (true) {
        const { data } = await client
          .from("flashcards")
          .select("id")
          .in("id", batchIds)
          .order("id", { ascending: true })
          .range(start, start + SCOPE_ID_PAGE_SIZE - 1);
        const page = data ?? [];
        results.push(...page.map((row: { id: string }) => row.id));
        if (page.length < SCOPE_ID_PAGE_SIZE) break;
        start += SCOPE_ID_PAGE_SIZE;
      }
    }
    return results;
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
        ...page.map(
          (event: { flashcard_id: string; is_correct: boolean | null; reviewed_at: string }) => ({
            flashcardId: event.flashcard_id,
            isCorrect: event.is_correct,
            reviewedAt: event.reviewed_at,
          }),
        ),
      );
      if (page.length < SCOPE_ID_PAGE_SIZE) return events;
      start += SCOPE_ID_PAGE_SIZE;
    }
  };

  const loadMasterySnapshot = async (userId: string, evaluationTime: string) => {
    return loadMasterySnapshotWithRepository(
      {
        findActiveCardIdsInScope: () => findActiveCardIdsInScope(userId),
        findActiveCardIds,
        findReviewEvents,
      },
      evaluationTime,
      undefined,
    );
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
      for (const row of page as Array<{ user_id: string }>) userIds.add(row.user_id);
      if (page.length < SCOPE_ID_PAGE_SIZE) break;
      start += SCOPE_ID_PAGE_SIZE;
    }
    return Array.from(userIds).sort();
  };

  const loadFsrsCardDetails = async (
    userId: string,
    cardIds: string[],
  ): Promise<FsrsOnlyCardDetail[]> => {
    if (cardIds.length === 0) return [];

    const results: FsrsOnlyCardDetail[] = [];
    const batchSize = 300;
    for (let i = 0; i < cardIds.length; i += batchSize) {
      const batch = cardIds.slice(i, i + batchSize);
      const { data } = await client
        .from("card_learning_schedule")
        .select(
          "flashcard_id, state, due, last_review, scheduled_days, processed_event_count, learning_steps, algorithm, implementation, parameter_set, last_processed_review_event_id",
        )
        .eq("user_id", userId)
        .in("flashcard_id", batch);
      const page = data ?? [];

      if (page.length > 0) {
        const eventIds = page.map(
          (row: { last_processed_review_event_id: string }) => row.last_processed_review_event_id,
        );
        const ratingMap = new Map<
          string,
          { fsrsRating: number | null; isCorrect: boolean | null }
        >();
        let j = 0;
        while (j < eventIds.length) {
          const batch2 = eventIds.slice(j, j + SCOPE_ID_PAGE_SIZE);
          const { data: events } = await client
            .from("card_review_events")
            .select("id, fsrs_rating, is_correct")
            .in("id", batch2);
          for (const ev of events ?? []) {
            const e = ev as { id: string; fsrs_rating: number | null; is_correct: boolean | null };
            ratingMap.set(e.id, { fsrsRating: e.fsrs_rating, isCorrect: e.is_correct });
          }
          j += SCOPE_ID_PAGE_SIZE;
        }

        for (const row of page as Array<{
          flashcard_id: string;
          state: number;
          due: string;
          last_review: string | null;
          scheduled_days: number;
          processed_event_count: number;
          learning_steps: number;
          algorithm: string;
          implementation: string;
          parameter_set: string;
          last_processed_review_event_id: string;
        }>) {
          const rating = ratingMap.get(row.last_processed_review_event_id);
          results.push({
            flashcardId: row.flashcard_id,
            state: row.state,
            due: row.due,
            lastReview: row.last_review,
            scheduledDays: row.scheduled_days,
            processedEventCount: row.processed_event_count,
            learningSteps: row.learning_steps,
            algorithm: row.algorithm,
            implementation: row.implementation,
            parameterSet: row.parameter_set,
            lastEventFsrsRating: rating?.fsrsRating ?? null,
            lastEventIsCorrect: rating?.isCorrect ?? null,
          });
        }
      }
    }

    return results;
  };

  return {
    loadUsersWithHistory,
    loadMasterySnapshot,
    loadFsrsDueCardIds: (userId, evaluationTime) =>
      findDueCandidates(client, userId, { type: "library" }, evaluationTime).then((candidates) =>
        candidates.map((candidate) => candidate.flashcardId),
      ),
    loadFsrsCardDetails,
    loadSchedulableEventsWithCardIds: async (userId, cardIds) => {
      if (cardIds.length === 0) return [];
      const all: Array<{
        flashcardId: string;
        id: string;
        reviewedAt: string;
        isCorrect: boolean | null;
        fsrsRating: number | null;
      }> = [];
      let start = 0;
      while (true) {
        const { data } = await client
          .from("card_review_events")
          .select("id, flashcard_id, reviewed_at, is_correct, fsrs_rating")
          .eq("user_id", userId)
          .in("flashcard_id", cardIds)
          .order("reviewed_at", { ascending: true })
          .range(start, start + SCOPE_ID_PAGE_SIZE - 1);
        const page = data ?? [];
        all.push(
          ...page.map(
            (row: {
              id: string;
              flashcard_id: string;
              reviewed_at: string;
              is_correct: boolean | null;
              fsrs_rating: number | null;
            }) => ({
              flashcardId: row.flashcard_id,
              id: row.id,
              reviewedAt: row.reviewed_at,
              isCorrect: row.is_correct,
              fsrsRating: row.fsrs_rating,
            }),
          ),
        );
        if (page.length < SCOPE_ID_PAGE_SIZE) return all;
        start += SCOPE_ID_PAGE_SIZE;
      }
    },
    loadCardTraceInfo: async (_userId, cardIds) => {
      if (cardIds.length === 0) return [];
      const all: Array<{
        flashcardId: string;
        existsInFlashcards: boolean;
        flashcardUserId: string | null;
        scheduleUserId: string;
      }> = [];
      for (const id of cardIds) {
        const { data } = await client.from("flashcards").select("user_id").eq("id", id).single();
        all.push({
          flashcardId: id,
          existsInFlashcards: data !== null,
          flashcardUserId: data?.user_id ?? null,
          scheduleUserId: _userId,
        });
      }
      return all;
    },
  };
}

function formatTransitionAnalysis(result: ProductionDiagnosticResult): string {
  const a = result.aggregate;
  const learning = a.stateBuckets.Learning;
  const relearning = a.stateBuckets.Relearning;
  const review = a.stateBuckets.Review;
  const total = a.totalFsrsOnlyCards;
  const oneEvent = a.oneReviewTotal;
  const shortTerm = a.shortTermLearningTotal;
  const strongMastery = a.masteryCrossTab.strong;

  const lines = [
    "",
    "TRANSITION ANALYSIS (informed assessment, not a decision)",
    "",
    "Total FSRS-only cards: " + total,
    `  Review state: ${review} — genuine long-term spaced-repetition debt`,
    `  Learning state: ${learning} — may include minute-level due times from short-term steps`,
    `  Relearning state: ${relearning}`,
    `  Short-term Learning/Relearning with scheduled_days=0: ${shortTerm}`,
    `  One-review cards: ${oneEvent}`,
    `  Scheduler mismatches: ${a.totalSchedulerMismatches}`,
    `  Replay check: ${a.replayCheck.mismatches}/${a.replayCheck.total} mismatches`,
    `  Mastery-strong FSRS-only: ${strongMastery}`,
    "",
    "Direct cutover would surface all " + total + " due cards in Smart Review immediately.",
    "  The current Smart Review surface shows far fewer (Mastery review-only filter).",
    "",
    "If the evidence shows:",
    "  A. Most FSRS-only cards are Review-state with processed_event_count >= 2",
    "     and replay is consistent → FSRS behavior is correct; cutover is valid.",
    "  B. Many cards are in Learning/Relearning from minute-level backfilled steps",
    "     → historical backfill creates review debt; consider a grace period or",
    "     Learning-state exclusion initially.",
    "  C. Replay shows mismatches → projection may be wrong; reconcile first.",
    "  D. Most FSRS-only cards are Mastery-strong → Mastery doesn't recommend review",
    "     (it's a confidence metric, not a scheduler). FSRS says they're due because",
    "     they haven't been reviewed recently enough. This is a semantic difference,",
    "     not a bug — cutting over would switch from confidence-based to",
    "     interval-based review eligibility.",
    "",
    "Algorithmic vs UX:",
    "  'algorithmically due' means FSRS says review now.",
    "  'how many to expose on rollout' is a UX/product decision.",
    "  These are separate concerns.",
    "  Do not corrupt FSRS schedules to make numbers look better.",
  ];

  return lines.join("\n");
}

function formatResult(projectRef: string, result: ProductionDiagnosticResult): string {
  const stateNames = ["New", "Learning", "Review", "Relearning"];
  const a = result.aggregate;

  const lines = [
    "FSRS PRODUCTION DUE-DIVERGENCE DIAGNOSTIC",
    "",
    `Project: ${projectRef}`,
    `Evaluation time (UTC): ${result.evaluationTime}`,
    `Users compared: ${result.perUser.length}`,
    `Total FSRS-only cards: ${a.totalFsrsOnlyCards}`,
    "",
    "=== PER-USER DUE DISTRIBUTION ===",
  ];

  for (const u of result.perUser) {
    lines.push(
      `  ${u.label}:`,
      `    FSRS-only cards: ${u.fsrsOnlyCount}`,
      `    Overdue median: ${u.overdueBuckets.medianHours.toFixed(1)}h`,
      `    Overdue p90:   ${u.overdueBuckets.p90Hours.toFixed(1)}h`,
      `    Overdue max:   ${u.overdueBuckets.maxHours.toFixed(1)}h`,
    );
  }

  lines.push("", "=== AGGREGATE STATE BREAKDOWN ===");
  for (const s of stateNames) {
    const key = s as keyof typeof a.stateBuckets;
    if (a.stateBuckets[key] > 0) {
      lines.push(`  ${s}: ${a.stateBuckets[key]}`);
    }
  }

  lines.push(
    "",
    "=== REVIEW COUNT BUCKETS ===",
    `  1:  ${a.reviewCountBuckets.count1}`,
    `  2:  ${a.reviewCountBuckets.count2}`,
    `  3:  ${a.reviewCountBuckets.count3}`,
    `  4:  ${a.reviewCountBuckets.count4}`,
    `  5-9:  ${a.reviewCountBuckets.count5to9}`,
    `  10+:  ${a.reviewCountBuckets.count10Plus}`,
    "",
    "=== LAST REVIEW AGE BUCKETS ===",
    `  <1h:      ${a.lastReviewAgeBuckets.lt1h}`,
    `  1h-24h:   ${a.lastReviewAgeBuckets.h1to24h}`,
    `  1-7d:     ${a.lastReviewAgeBuckets.d1to7}`,
    `  7-30d:    ${a.lastReviewAgeBuckets.d7to30}`,
    `  30-90d:   ${a.lastReviewAgeBuckets.d30to90}`,
    `  >90d:     ${a.lastReviewAgeBuckets.gt90d}`,
    "",
    "=== OVERDUE AGE BUCKETS ===",
    `  within 1h: ${a.overdueBuckets.within1h}`,
    `  1h-24h:    ${a.overdueBuckets.h1to24h}`,
    `  1-7d:      ${a.overdueBuckets.d1to7}`,
    `  7-30d:     ${a.overdueBuckets.d7to30}`,
    `  30-90d:    ${a.overdueBuckets.d30to90}`,
    `  >90d:      ${a.overdueBuckets.gt90d}`,
    "",
    "=== LAST EVENT OUTCOME ===",
    `  Again (rating=1):       ${a.lastEventOutcome.again}`,
    `  Hard (rating=2):        ${a.lastEventOutcome.hard}`,
    `  Good (rating=3):        ${a.lastEventOutcome.good}`,
    `  Easy (rating=4):        ${a.lastEventOutcome.easy}`,
    `  Binary correct (null):  ${a.lastEventOutcome.binaryCorrect}`,
    `  Binary incorrect (null):${a.lastEventOutcome.binaryIncorrect}`,
    `  Unknown/null:           ${a.lastEventOutcome.unknown}`,
    "",
    "=== MASTERY STATUS CROSS-TAB ===",
    `  untested:  ${a.masteryCrossTab.untested}`,
    `  review:    ${a.masteryCrossTab.review}`,
    `  learning:  ${a.masteryCrossTab.learning}`,
    `  strong:    ${a.masteryCrossTab.strong}`,
    "  Score buckets:",
    `    0-20:    ${a.masteryCrossTab.scoreBuckets.sc0to20}`,
    `    21-40:   ${a.masteryCrossTab.scoreBuckets.sc21to40}`,
    `    41-60:   ${a.masteryCrossTab.scoreBuckets.sc41to60}`,
    `    61-80:   ${a.masteryCrossTab.scoreBuckets.sc61to80}`,
    `    81-100:  ${a.masteryCrossTab.scoreBuckets.sc81to100}`,
    `    no score: ${a.masteryCrossTab.scoreBuckets.noScore}`,
    "",
    "=== ONE-REVIEW CARDS (processed_event_count = 1) ===",
    `  Total:              ${a.oneReviewTotal}`,
    "",
    "=== SHORT-TERM LEARNING (scheduled_days = 0) ===",
    `  Total: ${a.shortTermLearningTotal}`,
    "",
    "=== SCHEDULER CONFIG CHECK ===",
    `  Mismatches (should be 0): ${a.totalSchedulerMismatches}`,
    "",
    "=== INVARIANTS ===",
  );

  const outcomeTotal =
    a.lastEventOutcome.again +
    a.lastEventOutcome.hard +
    a.lastEventOutcome.good +
    a.lastEventOutcome.easy +
    a.lastEventOutcome.binaryCorrect +
    a.lastEventOutcome.binaryIncorrect +
    a.lastEventOutcome.unknown;

  lines.push(
    `  FSRS-only cards:                     ${a.totalFsrsOnlyCards}`,
    `  Last-outcome classified cards:        ${outcomeTotal}`,
    `  Outcome classification gap:           ${a.totalFsrsOnlyCards - outcomeTotal}`,
    "",
    `  Untested-with-history cards:          ${a.untestedWithHistoryTotal}`,
    "",
    "=== REPLAY CONSISTENCY ===",
    `  Sampled: ${a.replayCheck.total}, Mismatches: ${a.replayCheck.mismatches}`,
    `  ${a.replayCheck.mismatches === 0 ? "ALL PROJECTIONS MATCH REPLAY" : "PROJECTION MISMATCH DETECTED"}`,
    "",
    "Per-user details:",
  );

  for (const u of result.perUser) {
    lines.push(
      `  ${u.label}:`,
      `    FSRS-only: ${u.fsrsOnlyCount}`,
      `    States — New:${u.stateBuckets.New} Learning:${u.stateBuckets.Learning} Review:${u.stateBuckets.Review} Relearning:${u.stateBuckets.Relearning}`,
      `    Review counts — 1:${u.reviewCountBuckets.count1} 2:${u.reviewCountBuckets.count2} 3:${u.reviewCountBuckets.count3} 4:${u.reviewCountBuckets.count4} 5-9:${u.reviewCountBuckets.count5to9} 10+:${u.reviewCountBuckets.count10Plus}`,
      `    Last-event outcome — Again:${u.lastEventOutcome.again} Hard:${u.lastEventOutcome.hard} Good:${u.lastEventOutcome.good} Easy:${u.lastEventOutcome.easy} BinCorrect:${u.lastEventOutcome.binaryCorrect} BinIncorrect:${u.lastEventOutcome.binaryIncorrect} Unknown:${u.lastEventOutcome.unknown}`,
      `    Mastery cross — untested:${u.masteryCrossTab.untested} review:${u.masteryCrossTab.review} learning:${u.masteryCrossTab.learning} strong:${u.masteryCrossTab.strong}`,
      `    One-review cards: ${u.oneReview.count}`,
      `    Short-term learning (scheduled_days=0): ${u.shortTermLearning.count}`,
      `    Review-state cards: ${u.reviewState.count}`,
      `    Scheduler mismatches: ${u.schedulerMismatchCount}`,
      `    Untested-with-history: ${u.untestedWithHistory.count} (noSnapshot:${u.untestedWithHistory.reasonCategories.noCardInMasterySnapshot} eventNotFound:${u.untestedWithHistory.reasonCategories.eventNotFound} other:${u.untestedWithHistory.reasonCategories.other})`,
    );
  }

  lines.push(formatTransitionAnalysis(result), "", "READ-ONLY — NO WRITES PERFORMED");

  return lines.join("\n");
}

function formatTraceReport(reports: readonly TraceMissingReport[]): string {
  const lines = ["", "=== CARD-SCOPE MISMATCH TRACE ===", ""];

  for (const r of reports) {
    lines.push(
      `  ${r.label}:`,
      `    FSRS-only cards:               ${r.fsrsOnlyCount}`,
      `    Missing from MasterySnapshot:  ${r.missingFromMasteryCount}`,
      "",
      "    Stage-by-stage:",
      `      Present in flashcards table:   ${r.stageByStage.presentInFlashcards}`,
      `      Pass ownership predicate:      ${r.stageByStage.passOwnership}`,
      `      Pass library scope:            ${r.stageByStage.passLibraryScope}`,
      `      Pass active-card predicate:    ${r.stageByStage.passActiveCardPredicate}`,
      `      Have schedulable review event: ${r.stageByStage.haveSchedulableEvent}`,
      `      Represented in MasterySnapshot:${r.stageByStage.representedInMasterySnapshot}`,
      `      Unexplained gap:               ${r.stageByStage.unexplainedGap}`,
      "",
      "    Reason categories:",
      `      absentFromFlashcards:          ${r.reasonCounts.absentFromFlashcards}`,
      `      ownershipMismatch:             ${r.reasonCounts.ownershipMismatch}`,
      `      presentInFlashcards:           ${r.reasonCounts.presentInFlashcards}`,
      `      unexplained:                   ${r.reasonCounts.unexplained}`,
      "",
      "    (No raw card IDs or content printed.)",
    );
  }

  return lines.join("\n");
}

async function main(): Promise<void> {
  const identity = resolveProductionIdentity(process.env, ALLOWED_PRODUCTION_PROJECT_REFS);
  const evaluationTime = new Date().toISOString();

  const client = createClient<Database>(identity.url, identity.serviceRoleKey);
  const data = await buildDataAccess(client);

  const traceMode = process.argv.includes("--trace-missing");

  if (traceMode) {
    console.log(`FSRS PRODUCTION CARD-SCOPE TRACE`);
    console.log(`Project: ${identity.projectRef}`);
    console.log(`Evaluation time (UTC): ${evaluationTime}`);
    const traceReports = await runMissingCardTrace(data, evaluationTime);
    console.log(formatTraceReport(traceReports));
    console.log("READ-ONLY — NO WRITES PERFORMED");
    return;
  }

  const result = await runProductionDiagnostic(data, evaluationTime);
  console.log(formatResult(identity.projectRef, result));
}

function isDirectExecution(): boolean {
  if (!process.argv[1]) return false;
  return (
    process.argv[1] === import.meta.url || pathToFileURL(process.argv[1]).href === import.meta.url
  );
}

if (isDirectExecution()) {
  main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
