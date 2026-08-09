import "server-only";

import { createEmptyCard, State, type Card, type FSRS } from "ts-fsrs";

import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

import { createFlashlearnScheduler, FLASHLEARN_SCHEDULER_IDENTITY } from "../config";
import {
  checkCardActive,
  countSchedulableEvents,
  loadAllSchedulableEvents,
  loadSchedule,
  loadSchedulableEventsAfter,
  type ScheduleRow,
  type SchedulableEventRow,
} from "./schedule-repository";
import type {
  FsrsReconciliationResult,
  ReplayMode,
  FsrsReconciliationStatus,
} from "../types/reconciliation-types";
import { ratingForReviewFact } from "../utils/rating-map";
import type { ReviewReplayFact } from "../types/spaced-repetition-types";

type Supabase = SupabaseClient<Database>;
const MAX_RETRIES = 3;

const CURRENT_CONFIG = {
  algorithm: FLASHLEARN_SCHEDULER_IDENTITY.algorithm as string,
  implementation: FLASHLEARN_SCHEDULER_IDENTITY.implementation as string,
  parameterSet: FLASHLEARN_SCHEDULER_IDENTITY.parameterSet as string,
};

function configMatches(schedule: ScheduleRow): boolean {
  return (
    schedule.algorithm === CURRENT_CONFIG.algorithm &&
    schedule.implementation === CURRENT_CONFIG.implementation &&
    schedule.parameterSet === CURRENT_CONFIG.parameterSet
  );
}

function factFromRow(row: SchedulableEventRow): ReviewReplayFact {
  return {
    eventId: row.id,
    reviewedAt: row.reviewedAt,
    isCorrect: row.isCorrect,
    fsrsRating: row.fsrsRating,
  };
}

function fsrsCardFromSchedule(schedule: ScheduleRow): Card {
  return {
    due: new Date(schedule.due),
    stability: schedule.stability,
    difficulty: schedule.difficulty,
    scheduled_days: schedule.scheduledDays,
    learning_steps: schedule.learningSteps,
    reps: schedule.reps,
    lapses: schedule.lapses,
    state: schedule.state as State,
    last_review: new Date(schedule.lastReview),
    elapsed_days: 0,
  };
}

async function callScheduleRpc(
  supabase: Supabase,
  userId: string,
  cardId: string,
  card: Card,
  processedEventCount: number,
  lastProcessedReviewedAt: string,
  lastProcessedReviewEventId: string,
  expectedRevision: number,
): Promise<number> {
  const admin = createAdminClient();
  const { data: revision, error } = await admin.rpc("upsert_card_learning_schedule", {
    p_user_id: userId,
    p_flashcard_id: cardId,
    p_expected_projection_revision: expectedRevision,
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
    p_algorithm: CURRENT_CONFIG.algorithm,
    p_implementation: CURRENT_CONFIG.implementation,
    p_parameter_set: CURRENT_CONFIG.parameterSet,
  });

  if (error) throw error;
  return revision as number;
}

function replayAll(events: readonly SchedulableEventRow[], scheduler: FSRS): Card {
  let card: Card = createEmptyCard(new Date(events[0]?.reviewedAt ?? Date.now()));
  for (const row of events) {
    const rating = ratingForReviewFact(factFromRow(row));
    if (rating === null) continue;
    card = scheduler.next(card, new Date(row.reviewedAt), rating).card;
  }
  return card;
}

function buildResult(
  status: FsrsReconciliationStatus,
  replayMode: ReplayMode,
  processedEventCount: number,
  projectionRevision: number | null,
): FsrsReconciliationResult {
  return { status, replayMode, processedEventCount, projectionRevision };
}

export async function reconcileCardSchedule(
  supabase: Supabase,
  userId: string,
  cardId: string,
): Promise<FsrsReconciliationResult> {
  const scheduler = createFlashlearnScheduler();

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const active = await checkCardActive(supabase, userId, cardId);
    if (!active) return buildResult("deleted", "none", 0, null);

    const totalCount = await countSchedulableEvents(supabase, userId, cardId);

    if (totalCount === 0) {
      return buildResult("no_schedule", "none", 0, null);
    }

    const existing = await loadSchedule(supabase, userId, cardId);

    if (!existing) {
      const allEvents = await loadAllSchedulableEvents(supabase, userId, cardId);
      const card = replayAll(allEvents, scheduler);
      const final = allEvents[allEvents.length - 1];

      try {
        const revision = await callScheduleRpc(
          supabase,
          userId,
          cardId,
          card,
          allEvents.length,
          final.reviewedAt,
          final.id,
          -1,
        );
        return buildResult("created", "full", allEvents.length, revision);
      } catch {
        continue; // CAS/freshness retry
      }
    }

    // Existing schedule: check config
    if (!configMatches(existing)) {
      const allEvents = await loadAllSchedulableEvents(supabase, userId, cardId);
      const card = replayAll(allEvents, scheduler);
      const final = allEvents[allEvents.length - 1];

      try {
        const revision = await callScheduleRpc(
          supabase,
          userId,
          cardId,
          card,
          allEvents.length,
          final.reviewedAt,
          final.id,
          existing.projectionRevision,
        );
        return buildResult("config_mismatch_rebuilt", "full", allEvents.length, revision);
      } catch {
        continue;
      }
    }

    // Count match: up to date
    if (totalCount === existing.processedEventCount) {
      return buildResult("up_to_date", "none", totalCount, existing.projectionRevision);
    }

    // Anomaly: count decreased (shouldn't happen with immutable events)
    if (totalCount < existing.processedEventCount) {
      const allEvents = await loadAllSchedulableEvents(supabase, userId, cardId);
      const card = replayAll(allEvents, scheduler);
      const final = allEvents[allEvents.length - 1];

      try {
        const revision = await callScheduleRpc(
          supabase,
          userId,
          cardId,
          card,
          allEvents.length,
          final.reviewedAt,
          final.id,
          existing.projectionRevision,
        );
        return buildResult("rebuilt", "full", allEvents.length, revision);
      } catch {
        continue;
      }
    }

    // More events exist: try incremental
    const after = await loadSchedulableEventsAfter(
      supabase,
      userId,
      cardId,
      existing.lastProcessedReviewedAt,
      existing.lastProcessedReviewEventId,
    );

    if (existing.processedEventCount + after.length === totalCount) {
      // Safe incremental
      let card = fsrsCardFromSchedule(existing);
      for (const row of after) {
        const rating = ratingForReviewFact(factFromRow(row));
        if (rating === null) continue;
        card = scheduler.next(card, new Date(row.reviewedAt), rating).card;
      }
      const final =
        after.length > 0
          ? after[after.length - 1]
          : {
              id: existing.lastProcessedReviewEventId,
              reviewedAt: existing.lastProcessedReviewedAt,
            };

      try {
        const revision = await callScheduleRpc(
          supabase,
          userId,
          cardId,
          card,
          totalCount,
          final.reviewedAt,
          final.id,
          existing.projectionRevision,
        );
        return buildResult(
          after.length > 0 ? "updated" : "up_to_date",
          "incremental",
          totalCount,
          revision,
        );
      } catch {
        continue;
      }
    }

    // Late/out-of-order events: full replay
    const allEvents = await loadAllSchedulableEvents(supabase, userId, cardId);
    const card = replayAll(allEvents, scheduler);
    const final = allEvents[allEvents.length - 1];

    try {
      const revision = await callScheduleRpc(
        supabase,
        userId,
        cardId,
        card,
        allEvents.length,
        final.reviewedAt,
        final.id,
        existing.projectionRevision,
      );
      return buildResult("rebuilt", "full", allEvents.length, revision);
    } catch {
      continue;
    }
  }

  throw new Error(`Reconciliation failed after ${MAX_RETRIES} retries for card ${cardId}`);
}
