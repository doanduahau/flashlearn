import type { SupabaseClient } from "@supabase/supabase-js";

import type { FsrsDueScope } from "../types/due-types";
import type { Database } from "../../../lib/supabase/types";
import {
  buildFsrsTransitionQueue,
  classifyCandidate,
  type ClassifiedCandidate,
  type CursorEvent,
  type FsrsTransitionQueue,
  type ScheduleCursor,
} from "../utils/transition-queue";

type Supabase = SupabaseClient<Database>;

const SCOPE_ID_PAGE_SIZE = 1000;
const EVENT_BATCH_SIZE = 200;

async function findScopedCardIds(
  supabase: Supabase,
  userId: string,
  scope: { type: "set"; setId: string } | { type: "collection"; collectionId: string },
): Promise<string[]> {
  if (scope.type === "set") {
    const ids: string[] = [];
    let start = 0;
    while (true) {
      const { data, error } = await supabase
        .from("flashcards")
        .select("id")
        .eq("user_id", userId)
        .eq("set_id", scope.setId)
        .order("id", { ascending: true })
        .range(start, start + SCOPE_ID_PAGE_SIZE - 1);
      if (error) throw error;
      const page = data ?? [];
      ids.push(...page.map((r) => r.id));
      if (page.length === 0) return ids;
      start += page.length;
    }
  }

  const ids: string[] = [];
  let start = 0;
  while (true) {
    const { data, error } = await supabase
      .from("special_collection_items")
      .select("flashcard_id")
      .eq("user_id", userId)
      .eq("collection_id", scope.collectionId)
      .order("flashcard_id", { ascending: true })
      .range(start, start + SCOPE_ID_PAGE_SIZE - 1);
    if (error) throw error;
    const page = data ?? [];
    ids.push(...page.map((r) => r.flashcard_id));
    if (page.length === 0) return ids;
    start += page.length;
  }
}

async function loadDueCandidatesWithCursors(
  supabase: Supabase,
  userId: string,
  scope: FsrsDueScope,
  evaluationTime: string,
): Promise<Array<FsrsDueCandidateLike & ScheduleCursor>> {
  const all: Array<FsrsDueCandidateLike & ScheduleCursor> = [];
  let start = 0;

  while (true) {
    let query = supabase
      .from("card_learning_schedule")
      .select(
        "flashcard_id, due, last_review, state, scheduled_days, last_processed_review_event_id",
      )
      .eq("user_id", userId)
      .lte("due", evaluationTime)
      .order("due", { ascending: true })
      .order("last_review", { ascending: true })
      .order("flashcard_id", { ascending: true });

    if (scope.type !== "library") {
      const scopedIds = await findScopedCardIds(supabase, userId, scope);
      query = query.in("flashcard_id", scopedIds);
    }

    const { data, error } = await query.range(start, start + SCOPE_ID_PAGE_SIZE - 1);
    if (error) throw error;

    const page = data ?? [];
    all.push(
      ...page.map(
        (row: {
          flashcard_id: string;
          due: string;
          last_review: string | null;
          state: number;
          scheduled_days: number;
          last_processed_review_event_id: string;
        }) => ({
          flashcardId: row.flashcard_id,
          due: row.due,
          lastReview: row.last_review,
          state: row.state,
          scheduledDays: row.scheduled_days,
          lastProcessedReviewEventId: row.last_processed_review_event_id,
        }),
      ),
    );

    if (page.length === 0) return all;
    start += page.length;
  }
}

type FsrsDueCandidateLike = {
  flashcardId: string;
  due: string;
  lastReview: string | null;
  state: number;
};

async function loadCursorEvents(
  supabase: Supabase,
  eventIds: readonly string[],
): Promise<Map<string, CursorEvent>> {
  const map = new Map<string, CursorEvent>();
  const uniqueIds = [...new Set(eventIds)];

  for (let batch = 0; batch < uniqueIds.length; batch += EVENT_BATCH_SIZE) {
    const batchIds = uniqueIds.slice(batch, batch + EVENT_BATCH_SIZE);
    const { data, error } = await supabase
      .from("card_review_events")
      .select("id, fsrs_rating, is_correct")
      .in("id", batchIds);

    if (error) throw error;

    for (const ev of data ?? []) {
      const row = ev as { id: string; fsrs_rating: number | null; is_correct: boolean | null };
      map.set(row.id, { fsrsRating: row.fsrs_rating, isCorrect: row.is_correct });
    }
  }

  return map;
}

export async function loadTransitionQueue(
  supabase: Supabase,
  userId: string,
  scope: FsrsDueScope,
  evaluationTime: string,
  batchSize?: number,
): Promise<FsrsTransitionQueue> {
  const candidates = await loadDueCandidatesWithCursors(supabase, userId, scope, evaluationTime);

  const eventIds = candidates.map((c) => c.lastProcessedReviewEventId);
  const cursorEvents = await loadCursorEvents(supabase, eventIds);

  const classified: ClassifiedCandidate[] = candidates.map((c) => {
    const event = cursorEvents.get(c.lastProcessedReviewEventId) ?? null;
    return {
      candidate: {
        flashcardId: c.flashcardId,
        due: c.due,
        lastReview: c.lastReview,
        state: c.state,
      },
      classification: classifyCandidate(
        {
          state: c.state,
          scheduledDays: c.scheduledDays,
          lastProcessedReviewEventId: c.lastProcessedReviewEventId,
        },
        event,
      ),
    };
  });

  return buildFsrsTransitionQueue(classified, evaluationTime, batchSize);
}
