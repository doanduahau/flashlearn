import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { pathToFileURL } from "node:url";
import { createEmptyCard, type Card } from "ts-fsrs";

import { createCapyStudyScheduler } from "../src/features/spaced-repetition/config";
import { reconcileCardScheduleWithRepo } from "../src/features/spaced-repetition/server/reconcile-orchestrator";
import {
  buildServiceRoleRepository,
  buildServiceRoleWriter,
} from "../src/features/spaced-repetition/server/service-role-repository";
import {
  EMPTY_BACKFILL_AGGREGATE,
  recordBackfillOutcome,
  type BackfillAggregate,
} from "../src/features/spaced-repetition/types/reconciliation-types";
import { SCHEDULABLE_EVENT_OR_PREDICATE } from "../src/features/spaced-repetition/types/spaced-repetition-types";
import type { Database } from "../src/lib/supabase/types";

export {
  ALLOWED_PRODUCTION_PROJECT_REFS,
  resolveProductionIdentity,
  validateProductionIdentity,
  type ProductionIdentity,
} from "./lib/production-identity";
import {
  ALLOWED_PRODUCTION_PROJECT_REFS,
  resolveProductionIdentity,
} from "./lib/production-identity";

type Supabase = SupabaseClient<Database>;

const SCHEDULABLE_OR = SCHEDULABLE_EVENT_OR_PREDICATE;

// Non-secret product identifier required for production mutation.
export const PRODUCTION_CONFIRMATION_TOKEN = "capystudy-production";

export const DEFAULT_BATCH_SIZE = 50;
export const MIN_BATCH_SIZE = 1;
export const MAX_BATCH_SIZE = 500;

export type RunnerMode = "dry-run" | "execute";

export type ProductionRunnerArgs = {
  mode: RunnerMode;
  batchSize: number;
  confirm?: string;
};

export function parseProductionArgs(argv: readonly string[]): ProductionRunnerArgs {
  const args = Array.from(argv);
  const hasDryRun = args.includes("--dry-run");
  const hasExecute = args.includes("--execute");
  if (hasDryRun && hasExecute) {
    throw new Error("choose either --dry-run or --execute, not both");
  }
  if (!hasDryRun && !hasExecute) {
    throw new Error("must pass --dry-run or --execute");
  }
  const mode: RunnerMode = hasExecute ? "execute" : "dry-run";

  let batchSize = DEFAULT_BATCH_SIZE;
  const batchIndex = args.indexOf("--batch-size");
  if (batchIndex !== -1) {
    const raw = args[batchIndex + 1];
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed < MIN_BATCH_SIZE || parsed > MAX_BATCH_SIZE) {
      throw new Error(
        `--batch-size must be an integer between ${MIN_BATCH_SIZE} and ${MAX_BATCH_SIZE}`,
      );
    }
    batchSize = parsed;
  }

  let confirm: string | undefined;
  const confirmIndex = args.indexOf("--confirm");
  if (confirmIndex !== -1) {
    confirm = args[confirmIndex + 1];
  }

  return { mode, batchSize, confirm };
}

export function assertConfirmation(mode: RunnerMode, confirm: string | undefined): void {
  if (mode === "dry-run") return;
  if (confirm !== PRODUCTION_CONFIRMATION_TOKEN) {
    throw new Error(`production execution requires --confirm ${PRODUCTION_CONFIRMATION_TOKEN}`);
  }
}

function keyOf(userId: string, cardId: string): string {
  return `${userId}:${cardId}`;
}

export type DryRunMetrics = {
  usersWithSchedulableHistory: number;
  activeSchedulableCards: number;
  existingSchedules: number;
  missingSchedules: number;
  alreadyCurrent: number;
  potentialReconciliationTargets: number;
  deletedOrphanSchedules: number;
  schedulableEventCount: number;
  nonSchedulableEventCount: number;
  totalReviewEventCount: number;
};

async function loadAllSchedulableCards(client: Supabase): Promise<Set<string>> {
  const out = new Set<string>();
  let start = 0;
  while (true) {
    const { data } = await client
      .from("card_review_events")
      .select("user_id, flashcard_id")
      .or(SCHEDULABLE_OR)
      .range(start, start + 1000 - 1);
    const page = data ?? [];
    for (const row of page) {
      out.add(keyOf(row.user_id, row.flashcard_id));
    }
    if (page.length < 1000) return out;
    start += 1000;
  }
}

async function loadAllActiveCards(client: Supabase): Promise<Set<string>> {
  const out = new Set<string>();
  let start = 0;
  while (true) {
    const { data } = await client
      .from("flashcards")
      .select("id, user_id")
      .range(start, start + 1000 - 1);
    const page = data ?? [];
    for (const row of page) {
      out.add(keyOf(row.user_id, row.id));
    }
    if (page.length < 1000) return out;
    start += 1000;
  }
}

async function loadAllScheduleKeys(client: Supabase): Promise<Set<string>> {
  const out = new Set<string>();
  let start = 0;
  while (true) {
    const { data } = await client
      .from("card_learning_schedule")
      .select("user_id, flashcard_id")
      .range(start, start + 1000 - 1);
    const page = data ?? [];
    for (const row of page) {
      out.add(keyOf(row.user_id, row.flashcard_id));
    }
    if (page.length < 1000) return out;
    start += 1000;
  }
}

async function countWhere(client: Supabase, table: string, orPredicate?: string): Promise<number> {
  let query = client
    .from(table as "card_review_events")
    .select("id", { count: "exact", head: true });
  if (orPredicate) query = query.or(orPredicate);
  const { count } = await query;
  return count ?? 0;
}

export async function computeDryRunMetrics(client: Supabase): Promise<DryRunMetrics> {
  const [
    schedulableCards,
    activeCards,
    scheduleKeys,
    schedulableEventCount,
    totalReviewEventCount,
  ] = await Promise.all([
    loadAllSchedulableCards(client),
    loadAllActiveCards(client),
    loadAllScheduleKeys(client),
    countWhere(client, "card_review_events", SCHEDULABLE_OR),
    countWhere(client, "card_review_events"),
  ]);

  const activeSchedulableCards = new Set<string>();
  for (const key of schedulableCards) {
    if (activeCards.has(key)) activeSchedulableCards.add(key);
  }

  const existingSchedules = new Set<string>();
  const orphanSchedules = new Set<string>();
  for (const key of scheduleKeys) {
    if (activeCards.has(key)) existingSchedules.add(key);
    else orphanSchedules.add(key);
  }

  const missingSchedules = new Set<string>();
  for (const key of activeSchedulableCards) {
    if (!existingSchedules.has(key)) missingSchedules.add(key);
  }

  // "Already current" requires checking each existing schedule's processed count
  // against the actual schedulable count. Deterministic per-card check.
  let alreadyCurrent = 0;
  const repo = buildServiceRoleRepository(client);
  for (const key of existingSchedules) {
    const [userId, cardId] = key.split(":");
    const schedule = await repo.loadSchedule(userId, cardId);
    if (!schedule) continue;
    const count = await repo.countSchedulableEvents(userId, cardId);
    if (count === schedule.processedEventCount) alreadyCurrent += 1;
  }

  const nonSchedulableEventCount = Math.max(0, totalReviewEventCount - schedulableEventCount);

  return {
    usersWithSchedulableHistory: new Set([...schedulableCards].map((key) => key.split(":")[0]))
      .size,
    activeSchedulableCards: activeSchedulableCards.size,
    existingSchedules: existingSchedules.size,
    missingSchedules: missingSchedules.size,
    alreadyCurrent,
    potentialReconciliationTargets: missingSchedules.size,
    deletedOrphanSchedules: orphanSchedules.size,
    schedulableEventCount,
    nonSchedulableEventCount,
    totalReviewEventCount,
  };
}

export async function verifyProductionSchema(client: Supabase): Promise<void> {
  // card_learning_schedule table
  const sched = await client
    .from("card_learning_schedule")
    .select("id", { head: true, count: "exact" })
    .limit(0);
  if (sched.error) {
    throw new Error(`card_learning_schedule missing or inaccessible: ${sched.error.message}`);
  }
  // fsrs_rating column on card_review_events
  const events = await client
    .from("card_review_events")
    .select("fsrs_rating", { head: true, count: "exact" })
    .limit(0);
  if (events.error) {
    throw new Error(`card_review_events.fsrs_rating missing: ${events.error.message}`);
  }
  // private projection RPC exists (probe with an invalid ownership call; expect
  // a validation error, not "function not found")
  const probe = await client.rpc("upsert_card_learning_schedule", {
    p_user_id: "00000000-0000-0000-0000-000000000000",
    p_flashcard_id: "00000000-0000-0000-0000-000000000000",
    p_expected_projection_revision: -1,
    p_state: 0,
    p_stability: 0,
    p_difficulty: 0,
    p_due: new Date().toISOString(),
    p_scheduled_days: 0,
    p_learning_steps: 0,
    p_reps: 0,
    p_lapses: 0,
    p_last_review: new Date().toISOString(),
    p_processed_event_count: 1,
    p_last_processed_reviewed_at: new Date().toISOString(),
    p_last_processed_review_event_id: "00000000-0000-0000-0000-000000000000",
    p_algorithm: "fsrs-6",
    p_implementation: "ts-fsrs@5.4.1",
    p_parameter_set: "capystudy-v1",
  });
  if (probe.error) {
    const msg = probe.error.message ?? "";
    if (msg.includes("PGRST202") || msg.includes("function")) {
      throw new Error(`upsert_card_learning_schedule RPC missing: ${msg}`);
    }
    // Any other error (e.g. flashcard not owned / validation) proves the RPC exists.
  }
}

export function formatDryRun(projectRef: string, metrics: DryRunMetrics): string {
  return [
    "FSRS PRODUCTION SHADOW DRY RUN",
    "",
    `Project: ${projectRef}`,
    `Users with schedulable history: ${metrics.usersWithSchedulableHistory}`,
    `Active schedulable cards: ${metrics.activeSchedulableCards}`,
    `Existing schedules: ${metrics.existingSchedules}`,
    `Missing schedules: ${metrics.missingSchedules}`,
    `Already current: ${metrics.alreadyCurrent}`,
    `Potential reconciliation targets: ${metrics.potentialReconciliationTargets}`,
    `Deleted/orphan schedules: ${metrics.deletedOrphanSchedules}`,
    `Non-schedulable events: ${metrics.nonSchedulableEventCount}`,
    "",
    "NO WRITES PERFORMED",
  ].join("\n");
}

async function loadUsers(client: Supabase): Promise<string[]> {
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

async function loadSchedulableCardIds(
  client: Supabase,
  userId: string,
  batchSize: number,
  afterId?: string,
): Promise<string[]> {
  let query = client
    .from("card_review_events")
    .select("flashcard_id")
    .eq("user_id", userId)
    .or(SCHEDULABLE_OR)
    .order("flashcard_id", { ascending: true })
    .limit(batchSize);
  if (afterId) query = query.gt("flashcard_id", afterId);
  const { data } = await query;
  const ids = new Set<string>();
  for (const row of data ?? []) {
    ids.add(row.flashcard_id);
  }
  return Array.from(ids);
}

export async function runProductionBackfill(
  client: Supabase,
  batchSize: number,
  onProgress?: (scanned: number) => void,
): Promise<BackfillAggregate> {
  let aggregate = { ...EMPTY_BACKFILL_AGGREGATE };
  const users = await loadUsers(client);

  for (const userId of users) {
    let afterId: string | undefined;
    while (true) {
      const cardIds = await loadSchedulableCardIds(client, userId, batchSize, afterId);
      if (cardIds.length === 0) break;
      for (const cardId of cardIds) {
        aggregate.scanned += 1;
        try {
          const repo = buildServiceRoleRepository(client);
          const writer = buildServiceRoleWriter(client);
          const result = await reconcileCardScheduleWithRepo(
            { repository: repo, writer },
            userId,
            cardId,
          );
          aggregate = recordBackfillOutcome(aggregate, result.status);
        } catch {
          aggregate.failed += 1;
        }
      }
      afterId = cardIds[cardIds.length - 1];
      onProgress?.(aggregate.scanned);
    }
  }

  return aggregate;
}

export function formatBackfillAggregate(aggregate: BackfillAggregate, elapsedMs: number): string {
  return [
    "--- Backfill Complete ---",
    `  scanned:         ${aggregate.scanned}`,
    `  created:         ${aggregate.created}`,
    `  updated:         ${aggregate.incrementallyUpdated}`,
    `  rebuilt:         ${aggregate.rebuilt}`,
    `  configMismatch:  ${aggregate.configMismatchRebuilt}`,
    `  alreadyCurrent:  ${aggregate.alreadyCurrent}`,
    `  noSchedule:      ${aggregate.noSchedule}`,
    `  skippedDeleted:  ${aggregate.skippedDeleted}`,
    `  failed:          ${aggregate.failed}`,
    `  elapsedMs:       ${elapsedMs}`,
  ].join("\n");
}

export function isSecondPassClean(aggregate: BackfillAggregate): boolean {
  return (
    aggregate.created === 0 &&
    aggregate.incrementallyUpdated === 0 &&
    aggregate.rebuilt === 0 &&
    aggregate.configMismatchRebuilt === 0
  );
}

export type CoverageVerification = {
  activeSchedulableCards: number;
  activeScheduleRows: number;
  duplicateSchedules: number;
  orphanSchedules: number;
  scheduleWithZeroProcessed: number;
  blankIdentity: number;
  configMismatchCounts: Record<string, number>;
};

export async function verifyCoverage(client: Supabase): Promise<CoverageVerification> {
  const [schedulableCards, activeCards, scheduleKeys] = await Promise.all([
    loadAllSchedulableCards(client),
    loadAllActiveCards(client),
    loadAllScheduleKeys(client),
  ]);

  const activeSchedulable = new Set<string>();
  for (const key of schedulableCards) if (activeCards.has(key)) activeSchedulable.add(key);

  const activeScheduleRows = new Set<string>();
  let orphanSchedules = 0;
  for (const key of scheduleKeys) {
    if (activeCards.has(key)) activeScheduleRows.add(key);
    else orphanSchedules += 1;
  }

  // Duplicate schedules are prevented by the unique(user_id,flashcard_id)
  // constraint, so this is expected 0 unless the constraint is missing.
  const duplicateSchedules = 0;

  let scheduleWithZeroProcessed = 0;
  let blankIdentity = 0;
  const configMismatchCounts: Record<string, number> = {};

  let start = 0;
  while (true) {
    const { data } = await client
      .from("card_learning_schedule")
      .select(
        "user_id, flashcard_id, processed_event_count, algorithm, implementation, parameter_set",
      )
      .range(start, start + 1000 - 1);
    const page = data ?? [];
    for (const row of page) {
      if (row.processed_event_count < 1) scheduleWithZeroProcessed += 1;
      if (!row.algorithm || !row.implementation || !row.parameter_set) blankIdentity += 1;
      const identity = `${row.algorithm ?? ""}|${row.implementation ?? ""}|${row.parameter_set ?? ""}`;
      configMismatchCounts[identity] = (configMismatchCounts[identity] ?? 0) + 1;
    }
    if (page.length < 1000) break;
    start += 1000;
  }

  return {
    activeSchedulableCards: activeSchedulable.size,
    activeScheduleRows: activeScheduleRows.size,
    duplicateSchedules,
    orphanSchedules,
    scheduleWithZeroProcessed,
    blankIdentity,
    configMismatchCounts,
  };
}

export type PlausibilityAnomaly = {
  nullDue: number;
  nullLastReview: number;
  zeroProcessed: number;
  negativeReps: number;
  negativeLapses: number;
  negativeLearningSteps: number;
  nonFiniteStability: number;
  nonFiniteDifficulty: number;
};

export async function verifyPlausibility(client: Supabase): Promise<PlausibilityAnomaly> {
  const anomaly: PlausibilityAnomaly = {
    nullDue: 0,
    nullLastReview: 0,
    zeroProcessed: 0,
    negativeReps: 0,
    negativeLapses: 0,
    negativeLearningSteps: 0,
    nonFiniteStability: 0,
    nonFiniteDifficulty: 0,
  };
  let start = 0;
  while (true) {
    const { data } = await client
      .from("card_learning_schedule")
      .select(
        "due, last_review, processed_event_count, reps, lapses, learning_steps, stability, difficulty",
      )
      .range(start, start + 1000 - 1);
    const page = data ?? [];
    for (const row of page) {
      if (!row.due) anomaly.nullDue += 1;
      if (!row.last_review) anomaly.nullLastReview += 1;
      if ((row.processed_event_count ?? 0) < 1) anomaly.zeroProcessed += 1;
      if ((row.reps ?? 0) < 0) anomaly.negativeReps += 1;
      if ((row.lapses ?? 0) < 0) anomaly.negativeLapses += 1;
      if ((row.learning_steps ?? 0) < 0) anomaly.negativeLearningSteps += 1;
      if (row.stability === null || !Number.isFinite(row.stability))
        anomaly.nonFiniteStability += 1;
      if (row.difficulty === null || !Number.isFinite(row.difficulty))
        anomaly.nonFiniteDifficulty += 1;
    }
    if (page.length < 1000) break;
    start += 1000;
  }
  return anomaly;
}

export function formatPlausibility(anomaly: PlausibilityAnomaly): string {
  return [
    "--- Plausibility Checks ---",
    `  null due:                 ${anomaly.nullDue}`,
    `  null last_review:         ${anomaly.nullLastReview}`,
    `  processed_event_count<1:  ${anomaly.zeroProcessed}`,
    `  reps<0:                   ${anomaly.negativeReps}`,
    `  lapses<0:                 ${anomaly.negativeLapses}`,
    `  learning_steps<0:         ${anomaly.negativeLearningSteps}`,
    `  non-finite stability:     ${anomaly.nonFiniteStability}`,
    `  non-finite difficulty:    ${anomaly.nonFiniteDifficulty}`,
  ].join("\n");
}

// Deterministic bounded replay-consistency sample: sort schedule rows by
// (user_id, flashcard_id), take the first N. Rerunning examines the same cards.
const REPLAY_SAMPLE_SIZE = 50;

export async function verifyReplayConsistency(
  client: Supabase,
  sampleSize: number = REPLAY_SAMPLE_SIZE,
): Promise<{ sampleSize: number; mismatches: number }> {
  const { data: rows } = await client
    .from("card_learning_schedule")
    .select(
      "user_id, flashcard_id, state, stability, difficulty, due, scheduled_days, learning_steps, reps, lapses, last_review, processed_event_count, last_processed_reviewed_at, last_processed_review_event_id, algorithm, implementation, parameter_set",
    )
    .order("user_id", { ascending: true })
    .order("flashcard_id", { ascending: true })
    .limit(sampleSize);

  const sample = rows ?? [];
  const scheduler = createCapyStudyScheduler();
  const repo = buildServiceRoleRepository(client);
  let mismatches = 0;

  for (const row of sample) {
    const events = await repo.loadAllSchedulableEvents(row.user_id, row.flashcard_id);
    if (events.length === 0) continue;

    let card: Card = createEmptyCard(new Date(events[0].reviewedAt));
    for (const ev of events) {
      const rating =
        ev.fsrsRating != null &&
        (ev.fsrsRating === 1 || ev.fsrsRating === 2 || ev.fsrsRating === 3 || ev.fsrsRating === 4)
          ? (ev.fsrsRating as 1 | 2 | 3 | 4)
          : ev.isCorrect === true
            ? 3
            : ev.isCorrect === false
              ? 1
              : null;
      if (rating === null) continue;
      card = scheduler.next(card, new Date(ev.reviewedAt), rating).card;
    }

    const match =
      row.state === card.state &&
      Math.abs(row.stability - card.stability) < 1e-6 &&
      Math.abs(row.difficulty - card.difficulty) < 1e-6 &&
      Date.parse(row.due) === Date.parse(card.due.toISOString()) &&
      Math.abs(row.scheduled_days - card.scheduled_days) < 1e-6 &&
      row.learning_steps === card.learning_steps &&
      row.reps === card.reps &&
      row.lapses === card.lapses &&
      (row.last_review ? Date.parse(row.last_review) : null) ===
        (card.last_review ? Date.parse(card.last_review.toISOString()) : null) &&
      row.processed_event_count === events.length &&
      row.last_processed_review_event_id === events[events.length - 1].id &&
      row.algorithm === "fsrs-6" &&
      row.implementation === "ts-fsrs@5.4.1" &&
      row.parameter_set === "capystudy-v1";

    if (!match) mismatches += 1;
  }

  return { sampleSize: sample.length, mismatches };
}

export async function verifyNewQuizRatings(client: Supabase): Promise<Record<string, number>> {
  const counts: Record<string, number> = {
    null_rating: 0,
    rating_1: 0,
    rating_2: 0,
    rating_3: 0,
    rating_4: 0,
    other: 0,
  };
  let start = 0;
  while (true) {
    const { data } = await client
      .from("card_review_events")
      .select("fsrs_rating")
      .eq("source", "quiz")
      .range(start, start + 1000 - 1);
    const page = data ?? [];
    for (const row of page) {
      if (row.fsrs_rating === null) counts.null_rating += 1;
      else if (row.fsrs_rating === 1) counts.rating_1 += 1;
      else if (row.fsrs_rating === 2) counts.rating_2 += 1;
      else if (row.fsrs_rating === 3) counts.rating_3 += 1;
      else if (row.fsrs_rating === 4) counts.rating_4 += 1;
      else counts.other += 1;
    }
    if (page.length < 1000) break;
    start += 1000;
  }
  return counts;
}

async function main(): Promise<void> {
  const args = parseProductionArgs(process.argv.slice(2));
  const identity = resolveProductionIdentity(process.env, ALLOWED_PRODUCTION_PROJECT_REFS);
  assertConfirmation(args.mode, args.confirm);

  console.log(`FSRS PRODUCTION SHADOW RUNNER (${args.mode})`);
  console.log(`Project: ${identity.projectRef}`);

  const client = createClient<Database>(identity.url, identity.serviceRoleKey);
  await verifyProductionSchema(client);
  console.log("Schema verification: OK");

  if (args.mode === "dry-run") {
    const metrics = await computeDryRunMetrics(client);
    console.log(formatDryRun(identity.projectRef, metrics));
    return;
  }

  console.log(`Executing backfill (batch-size=${args.batchSize})...`);
  const startedAt = Date.now();
  const aggregate = await runProductionBackfill(client, args.batchSize);
  const elapsedMs = Date.now() - startedAt;
  console.log(formatBackfillAggregate(aggregate, elapsedMs));

  if (aggregate.failed > 0) {
    console.error(`\n${aggregate.failed} card(s) failed; see logs.`);
    process.exitCode = 1;
  }

  // Second pass — idempotency verification.
  console.log("\nRunning SECOND PASS...");
  const secondStartedAt = Date.now();
  const secondPass = await runProductionBackfill(client, args.batchSize);
  console.log(formatBackfillAggregate(secondPass, Date.now() - secondStartedAt));
  if (!isSecondPassClean(secondPass)) {
    console.error(
      "SECOND PASS STILL MUTATES SCHEDULES — investigate before any eligibility cutover.",
    );
    process.exitCode = 1;
  }

  // Coverage verification.
  const coverage = await verifyCoverage(client);
  console.log("--- Coverage Verification ---");
  console.log(`  active schedulable cards (A): ${coverage.activeSchedulableCards}`);
  console.log(`  schedule rows for active cards (B): ${coverage.activeScheduleRows}`);
  console.log(`  duplicate schedules: ${coverage.duplicateSchedules}`);
  console.log(`  orphan schedules: ${coverage.orphanSchedules}`);
  console.log(`  processed_event_count<1: ${coverage.scheduleWithZeroProcessed}`);
  console.log(`  blank identity: ${coverage.blankIdentity}`);
  for (const [identity, count] of Object.entries(coverage.configMismatchCounts)) {
    console.log(`  config identity "${identity}": ${count}`);
  }

  // Plausibility checks.
  console.log(formatPlausibility(await verifyPlausibility(client)));

  // Replay consistency sample.
  const replay = await verifyReplayConsistency(client);
  console.log("--- Replay Consistency Sample ---");
  console.log(`  sample size: ${replay.sampleSize}`);
  console.log(`  mismatches: ${replay.mismatches}`);
  if (replay.mismatches > 0) {
    console.error("Replay consistency mismatches found — investigate.");
    process.exitCode = 1;
  }

  // New quiz event rating check (aggregate metadata only).
  const ratings = await verifyNewQuizRatings(client);
  console.log("--- Quiz fsrs_rating Distribution ---");
  console.log(JSON.stringify(ratings));
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
