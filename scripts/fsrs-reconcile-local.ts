import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { reconcileCardScheduleWithRepo } from "../src/features/spaced-repetition/server/reconcile-orchestrator";
import {
  EMPTY_BACKFILL_AGGREGATE,
  recordBackfillOutcome,
  type FsrsReconciliationStatus,
} from "../src/features/spaced-repetition/types/reconciliation-types";
import {
  SCHEDULABLE_EVENT_OR_PREDICATE,
  isSchedulableEventRow,
} from "../src/features/spaced-repetition/types/spaced-repetition-types";
import type { Database } from "../src/lib/supabase/types";
import { resolveLocalSupabaseEnv } from "./lib/local-supabase-env.mjs";

// Local-only safety: reuse the established local-endpoint guard. The runner
// refuses production/non-local Supabase URLs before touching anything.
const npmCliPath = process.env.npm_execpath;
if (!npmCliPath) throw new Error("npm_execpath is required; run via npm script.");

const CARD_BATCH_SIZE = 50;

type Supabase = SupabaseClient<Database>;

const SCHEDULABLE_OR = SCHEDULABLE_EVENT_OR_PREDICATE;

async function resolveClient(): Promise<Supabase> {
  const env = await resolveLocalSupabaseEnv(npmCliPath);
  const client = createClient<Database>(env.supabaseUrl, env.serviceRoleKey);
  return client;
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

async function loadActiveCardIds(
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

  if (afterId) {
    query = query.gt("flashcard_id", afterId);
  }

  const { data } = await query;

  const ids = new Set<string>();
  for (const row of data ?? []) {
    ids.add(row.flashcard_id);
  }
  return Array.from(ids);
}

async function reconcileCard(
  client: Supabase,
  userId: string,
  cardId: string,
): Promise<FsrsReconciliationStatus> {
  const repository = {
    loadSchedule: async () => {
      const { data } = await client
        .from("card_learning_schedule")
        .select("*")
        .eq("user_id", userId)
        .eq("flashcard_id", cardId)
        .maybeSingle();
      if (!data) return null;
      return {
        state: data.state,
        stability: data.stability,
        difficulty: data.difficulty,
        due: data.due,
        scheduledDays: data.scheduled_days,
        learningSteps: data.learning_steps,
        reps: data.reps,
        lapses: data.lapses,
        lastReview: data.last_review,
        projectionRevision: data.projection_revision,
        processedEventCount: data.processed_event_count,
        lastProcessedReviewedAt: data.last_processed_reviewed_at,
        lastProcessedReviewEventId: data.last_processed_review_event_id,
        algorithm: data.algorithm,
        implementation: data.implementation,
        parameterSet: data.parameter_set,
        updatedAt: data.updated_at,
      };
    },
    countSchedulableEvents: async () => {
      const { count } = await client
        .from("card_review_events")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("flashcard_id", cardId)
        .or(SCHEDULABLE_OR);
      return count ?? 0;
    },
    loadSchedulableEventsAfter: async (
      _uid: string,
      _cid: string,
      lastReviewedAt: string,
      lastEventId: string,
    ) => {
      const { data } = await client
        .from("card_review_events")
        .select("id, reviewed_at, is_correct, fsrs_rating")
        .eq("user_id", userId)
        .eq("flashcard_id", cardId)
        .or(
          `reviewed_at.gt.${lastReviewedAt},and(reviewed_at.eq.${lastReviewedAt},id.gt.${lastEventId})`,
        )
        .order("reviewed_at", { ascending: true })
        .order("id", { ascending: true });
      return (data ?? [])
        .map((row) => ({
          id: row.id,
          reviewedAt: row.reviewed_at,
          isCorrect: row.is_correct,
          fsrsRating: row.fsrs_rating,
        }))
        .filter(isSchedulableEventRow);
    },
    loadAllSchedulableEvents: async () => {
      const results: Array<{
        id: string;
        reviewedAt: string;
        isCorrect: boolean | null;
        fsrsRating: number | null;
      }> = [];
      let start = 0;
      while (true) {
        const { data } = await client
          .from("card_review_events")
          .select("id, reviewed_at, is_correct, fsrs_rating")
          .eq("user_id", userId)
          .eq("flashcard_id", cardId)
          .or(SCHEDULABLE_OR)
          .order("reviewed_at", { ascending: true })
          .order("id", { ascending: true })
          .range(start, start + 1000 - 1);
        const page = data ?? [];
        results.push(
          ...page.map((row) => ({
            id: row.id,
            reviewedAt: row.reviewed_at,
            isCorrect: row.is_correct,
            fsrsRating: row.fsrs_rating,
          })),
        );
        if (page.length < 1000) return results;
        start += 1000;
      }
    },
    checkCardActive: async () => {
      const { count } = await client
        .from("flashcards")
        .select("id", { count: "exact", head: true })
        .eq("id", cardId)
        .eq("user_id", userId);
      return (count ?? 0) > 0;
    },
  };

  const writer = {
    upsert: async ({
      expectedProjectionRevision,
      card,
      processedEventCount,
      lastProcessedReviewedAt,
      lastProcessedReviewEventId,
    }: {
      userId: string;
      cardId: string;
      expectedProjectionRevision: number;
      card: {
        state: number;
        stability: number;
        difficulty: number;
        due: Date;
        scheduled_days: number;
        learning_steps: number;
        reps: number;
        lapses: number;
        last_review?: Date;
      };
      processedEventCount: number;
      lastProcessedReviewedAt: string;
      lastProcessedReviewEventId: string;
    }) => {
      const { data: revision, error } = await client.rpc("upsert_card_learning_schedule", {
        p_user_id: userId,
        p_flashcard_id: cardId,
        p_expected_projection_revision: expectedProjectionRevision,
        p_state: card.state,
        p_stability: card.stability,
        p_difficulty: card.difficulty,
        p_due: card.due.toISOString(),
        p_scheduled_days: card.scheduled_days,
        p_learning_steps: card.learning_steps,
        p_reps: card.reps,
        p_lapses: card.lapses,
        p_last_review: card.last_review?.toISOString() ?? card.due.toISOString(),
        p_processed_event_count: processedEventCount,
        p_last_processed_reviewed_at: lastProcessedReviewedAt,
        p_last_processed_review_event_id: lastProcessedReviewEventId,
        p_algorithm: "fsrs-6",
        p_implementation: "ts-fsrs@5.4.1",
        p_parameter_set: "flashlearn-v1",
      });
      if (error) throw error;
      return revision as number;
    },
  };

  const result = await reconcileCardScheduleWithRepo({ repository, writer }, userId, cardId);
  return result.status;
}

async function main(): Promise<void> {
  console.log("Verifying local Supabase...");
  const client = await resolveClient();
  console.log("Connected.");

  console.log("Loading users with FSRS-eligible review history...");
  const users = await loadUsers(client);
  console.log(`Found ${users.length} user(s).`);

  const aggregate = { ...EMPTY_BACKFILL_AGGREGATE };

  for (const userId of users) {
    let afterId: string | undefined;

    while (true) {
      const cardIds = await loadActiveCardIds(client, userId, CARD_BATCH_SIZE, afterId);
      if (cardIds.length === 0) break;

      for (const cardId of cardIds) {
        aggregate.scanned += 1;
        try {
          const status = await reconcileCard(client, userId, cardId);
          recordBackfillOutcome(aggregate, status);
        } catch {
          aggregate.failed += 1;
        }
      }

      afterId = cardIds[cardIds.length - 1];

      if (aggregate.scanned % 50 === 0) {
        console.log(
          `  progress: scanned=${aggregate.scanned} created=${aggregate.created} updated=${aggregate.incrementallyUpdated} rebuilt=${aggregate.rebuilt} upToDate=${aggregate.alreadyCurrent} failed=${aggregate.failed}`,
        );
      }
    }
  }

  console.log("\n--- Backfill Complete ---");
  console.log(`  scanned:         ${aggregate.scanned}`);
  console.log(`  created:         ${aggregate.created}`);
  console.log(`  updated:         ${aggregate.incrementallyUpdated}`);
  console.log(`  rebuilt:         ${aggregate.rebuilt}`);
  console.log(`  configMismatch:  ${aggregate.configMismatchRebuilt}`);
  console.log(`  alreadyCurrent:  ${aggregate.alreadyCurrent}`);
  console.log(`  noSchedule:      ${aggregate.noSchedule}`);
  console.log(`  skippedDeleted:  ${aggregate.skippedDeleted}`);
  console.log(`  failed:          ${aggregate.failed}`);

  if (aggregate.failed > 0) {
    process.exitCode = 1;
    console.error(`\n${aggregate.failed} card(s) failed reconciliation.`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
