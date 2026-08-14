import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

import {
  reconcileCardScheduleWithRepo,
  type ScheduleReconcileRepository,
  type ScheduleReconcileWriter,
} from "./reconcile-orchestrator";
import {
  checkCardActive,
  countSchedulableEvents,
  loadAllSchedulableEvents,
  loadSchedule,
  loadSchedulableEventsAfter,
} from "./schedule-repository";
import type { FsrsReconciliationResult } from "../types/reconciliation-types";

type Supabase = SupabaseClient<Database>;

function buildRepository(supabase: Supabase): ScheduleReconcileRepository {
  return {
    loadSchedule: (userId, cardId) => loadSchedule(supabase, userId, cardId),
    countSchedulableEvents: (userId, cardId) => countSchedulableEvents(supabase, userId, cardId),
    loadSchedulableEventsAfter: (userId, cardId, lastReviewedAt, lastEventId) =>
      loadSchedulableEventsAfter(supabase, userId, cardId, lastReviewedAt, lastEventId),
    loadAllSchedulableEvents: (userId, cardId) =>
      loadAllSchedulableEvents(supabase, userId, cardId),
    checkCardActive: (userId, cardId) => checkCardActive(supabase, userId, cardId),
  };
}

function buildWriter(): ScheduleReconcileWriter {
  const admin = createAdminClient();
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
      const { data: revision, error } = await admin.rpc("upsert_card_learning_schedule", {
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

export async function reconcileCardSchedule(
  supabase: Supabase,
  userId: string,
  cardId: string,
): Promise<FsrsReconciliationResult> {
  return reconcileCardScheduleWithRepo(
    { repository: buildRepository(supabase), writer: buildWriter() },
    userId,
    cardId,
  );
}
