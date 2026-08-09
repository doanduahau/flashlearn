import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/types";

type Supabase = SupabaseClient<Database>;

const EVENT_PAGE_SIZE = 1000;

export type ScheduleRow = {
  state: number;
  stability: number;
  difficulty: number;
  due: string;
  scheduledDays: number;
  learningSteps: number;
  reps: number;
  lapses: number;
  lastReview: string;
  projectionRevision: number;
  processedEventCount: number;
  lastProcessedReviewedAt: string;
  lastProcessedReviewEventId: string;
  algorithm: string;
  implementation: string;
  parameterSet: string;
};

export type SchedulableEventRow = {
  id: string;
  reviewedAt: string;
  isCorrect: boolean | null;
  fsrsRating: number | null;
};

export async function loadSchedule(
  supabase: Supabase,
  userId: string,
  cardId: string,
): Promise<ScheduleRow | null> {
  const { data } = await supabase
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
  };
}

export async function countSchedulableEvents(
  supabase: Supabase,
  userId: string,
  cardId: string,
): Promise<number> {
  const { count } = await supabase
    .from("card_review_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("flashcard_id", cardId)
    .or("fsrs_rating.gte.1,and,fsrs_rating.lte.4,is_correct.not.is.null");
  return count ?? 0;
}

export async function loadSchedulableEventsAfter(
  supabase: Supabase,
  userId: string,
  cardId: string,
  lastReviewedAt: string,
  lastEventId: string,
): Promise<SchedulableEventRow[]> {
  const results: SchedulableEventRow[] = [];

  // Query events with reviewed_at > cursor OR (equal timestamp AND id > cursor)
  const { data } = await supabase
    .from("card_review_events")
    .select("id, reviewed_at, is_correct, fsrs_rating")
    .eq("user_id", userId)
    .eq("flashcard_id", cardId)
    .or(
      `reviewed_at.gt.${lastReviewedAt},and(reviewed_at.eq.${lastReviewedAt},id.gt.${lastEventId})`,
    )
    .order("reviewed_at", { ascending: true })
    .order("id", { ascending: true });

  if (!data) return results;

  for (const row of data) {
    const isSchedulable =
      (row.fsrs_rating !== null && row.fsrs_rating >= 1 && row.fsrs_rating <= 4) ||
      row.is_correct !== null;
    if (isSchedulable) {
      results.push({
        id: row.id,
        reviewedAt: row.reviewed_at,
        isCorrect: row.is_correct,
        fsrsRating: row.fsrs_rating,
      });
    }
  }

  return results;
}

export async function loadAllSchedulableEvents(
  supabase: Supabase,
  userId: string,
  cardId: string,
): Promise<SchedulableEventRow[]> {
  const results: SchedulableEventRow[] = [];
  let start = 0;

  while (true) {
    const { data } = await supabase
      .from("card_review_events")
      .select("id, reviewed_at, is_correct, fsrs_rating")
      .eq("user_id", userId)
      .eq("flashcard_id", cardId)
      .or("fsrs_rating.gte.1,and,fsrs_rating.lte.4,is_correct.not.is.null")
      .order("reviewed_at", { ascending: true })
      .order("id", { ascending: true })
      .range(start, start + EVENT_PAGE_SIZE - 1);

    const page = data ?? [];
    results.push(
      ...page.map((row) => ({
        id: row.id,
        reviewedAt: row.reviewed_at,
        isCorrect: row.is_correct,
        fsrsRating: row.fsrs_rating,
      })),
    );
    if (page.length < EVENT_PAGE_SIZE) return results;
    start += EVENT_PAGE_SIZE;
  }
}

export async function checkCardActive(
  supabase: Supabase,
  userId: string,
  cardId: string,
): Promise<boolean> {
  const { count } = await supabase
    .from("flashcards")
    .select("id", { count: "exact", head: true })
    .eq("id", cardId)
    .eq("user_id", userId);
  return (count ?? 0) > 0;
}

export async function loadActiveCardIdsWithSchedulableHistory(
  supabase: Supabase,
  userId: string,
  batchSize: number,
  afterId?: string,
): Promise<string[]> {
  let query = supabase
    .from("card_review_events")
    .select("flashcard_id")
    .eq("user_id", userId)
    .or("fsrs_rating.gte.1,and,fsrs_rating.lte.4,is_correct.not.is.null")
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
