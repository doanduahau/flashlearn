import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  ScheduleReconcileRepository,
  ScheduleReconcileWriter,
} from "./reconcile-orchestrator";
import {
  SCHEDULABLE_EVENT_OR_PREDICATE,
  isSchedulableEventRow,
  type ScheduleRow,
  type SchedulableEventRow,
} from "../types/spaced-repetition-types";
import type { Database } from "../../../lib/supabase/types";

type Supabase = SupabaseClient<Database>;

/**
 * Build the read-side reconciliation repository from a service-role client.
 * Non-server-only so both the local and production backfill runners can reuse
 * it without importing Next.js server-only modules.
 */
export function buildServiceRoleRepository(client: Supabase): ScheduleReconcileRepository {
  return {
    loadSchedule: async (userId, cardId) => {
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
    countSchedulableEvents: async (userId, cardId) => {
      const { count } = await client
        .from("card_review_events")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("flashcard_id", cardId)
        .or(SCHEDULABLE_EVENT_OR_PREDICATE);
      return count ?? 0;
    },
    loadSchedulableEventsAfter: async (userId, cardId, lastReviewedAt, lastEventId) => {
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
    loadAllSchedulableEvents: async (userId, cardId) => {
      const results: SchedulableEventRow[] = [];
      let start = 0;
      while (true) {
        const { data } = await client
          .from("card_review_events")
          .select("id, reviewed_at, is_correct, fsrs_rating")
          .eq("user_id", userId)
          .eq("flashcard_id", cardId)
          .or(SCHEDULABLE_EVENT_OR_PREDICATE)
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
    checkCardActive: async (userId, cardId) => {
      const { count } = await client
        .from("flashcards")
        .select("id", { count: "exact", head: true })
        .eq("id", cardId)
        .eq("user_id", userId);
      return (count ?? 0) > 0;
    },
  };
}

/**
 * Build the write-side CAS projection writer from a service-role client. Uses
 * the same private RPC contract as the Next.js server path.
 */
export function buildServiceRoleWriter(client: Supabase): ScheduleReconcileWriter {
  return {
    upsert: async ({
      userId,
      cardId,
      expectedProjectionRevision,
      card,
      processedEventCount,
      lastProcessedReviewedAt,
      lastProcessedReviewEventId,
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
        p_parameter_set: "capystudy-v1",
      });
      if (error) throw error;
      return revision as number;
    },
  };
}

export type { ScheduleRow };
