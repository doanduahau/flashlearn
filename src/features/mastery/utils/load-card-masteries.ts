import type {
  ActiveFlashcardMastery,
  CardMasteryRepository,
  CardReviewEventRow,
} from "@/features/mastery/types/mastery-types";
import { deriveFlashcardMastery } from "@/features/mastery/utils/derive-flashcard-mastery";

function uniqueCardIds(cardIds: readonly string[]): string[] {
  return [...new Set(cardIds)];
}

export async function loadCardMasteriesWithRepository(
  repository: CardMasteryRepository,
  requestedCardIds: readonly string[],
  evaluationTime: string,
): Promise<ActiveFlashcardMastery[]> {
  const uniqueIds = uniqueCardIds(requestedCardIds);
  if (uniqueIds.length === 0) return [];

  const activeCardIds = await repository.findActiveCardIds(uniqueIds);
  if (activeCardIds.length === 0) return [];

  const eventsByCardId = new Map<string, CardReviewEventRow[]>();
  for (const event of await repository.findReviewEvents(activeCardIds)) {
    const events = eventsByCardId.get(event.flashcardId) ?? [];
    events.push(event);
    eventsByCardId.set(event.flashcardId, events);
  }

  return activeCardIds.map((flashcardId) => ({
    flashcardId,
    ...deriveFlashcardMastery(eventsByCardId.get(flashcardId) ?? [], evaluationTime),
  }));
}
