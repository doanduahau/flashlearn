import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  ActiveFlashcardMastery,
  CardReviewEventRow,
} from "@/features/mastery/types/mastery-types";
import {
  ACTIVE_CARD_IN_BATCH_SIZE,
  findActiveCardIdsWithOptions,
} from "@/features/mastery/utils/find-active-card-ids";
import { loadCardMasteriesWithRepository } from "@/features/mastery/utils/load-card-masteries";
import type { Database } from "@/lib/supabase/types";

type Supabase = SupabaseClient<Database>;

const REVIEW_EVENT_PAGE_SIZE = 1000;

export async function findActiveCardIds(
  supabase: Supabase,
  cardIds: readonly string[],
): Promise<string[]> {
  return findActiveCardIdsWithOptions(supabase, cardIds, {
    inBatchSize: ACTIVE_CARD_IN_BATCH_SIZE,
  });
}

export async function findReviewEvents(
  supabase: Supabase,
  cardIds: readonly string[],
): Promise<CardReviewEventRow[]> {
  const events: CardReviewEventRow[] = [];
  const uniqueIds = [...new Set(cardIds)];

  for (let batch = 0; batch < uniqueIds.length; batch += ACTIVE_CARD_IN_BATCH_SIZE) {
    const batchIds = uniqueIds.slice(batch, batch + ACTIVE_CARD_IN_BATCH_SIZE);
    let start = 0;

    while (true) {
      const { data, error } = await supabase
        .from("card_review_events")
        .select("flashcard_id, is_correct, reviewed_at")
        .in("flashcard_id", batchIds)
        .order("reviewed_at", { ascending: true })
        .range(start, start + REVIEW_EVENT_PAGE_SIZE - 1);

      if (error) throw new Error("Unable to load review events for mastery");

      const page = data ?? [];
      events.push(
        ...page.map((event) => ({
          flashcardId: event.flashcard_id,
          isCorrect: event.is_correct,
          reviewedAt: event.reviewed_at,
        })),
      );
      if (page.length === 0) break;
      start += page.length;
    }
  }

  return events;
}

export async function loadCardMasteries(
  supabase: Supabase,
  requestedCardIds: readonly string[],
  evaluationTime = new Date().toISOString(),
): Promise<ActiveFlashcardMastery[]> {
  return loadCardMasteriesWithRepository(
    {
      findActiveCardIds: (cardIds) => findActiveCardIds(supabase, cardIds),
      findReviewEvents: (cardIds) => findReviewEvents(supabase, cardIds),
    },
    requestedCardIds,
    evaluationTime,
  );
}
