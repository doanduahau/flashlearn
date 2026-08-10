import type {
  ActiveFlashcardMastery,
  CardMasteryRepository,
  MasteryPipelineTrace,
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
  pipelineTrace?: MasteryPipelineTrace,
): Promise<ActiveFlashcardMastery[]> {
  const uniqueIds = uniqueCardIds(requestedCardIds);
  pipelineTrace?.requestedCardIds.push(...uniqueIds);
  if (uniqueIds.length === 0) return [];

  const activeCardIds = await repository.findActiveCardIds(uniqueIds);
  pipelineTrace?.activeCardIds.push(...activeCardIds);
  if (activeCardIds.length === 0) return [];

  const eventsByCardId = new Map<string, CardReviewEventRow[]>();
  const reviewEvents = await repository.findReviewEvents(activeCardIds);
  pipelineTrace?.reviewEventCardIds.push(...reviewEvents.map((event) => event.flashcardId));
  for (const event of reviewEvents) {
    const events = eventsByCardId.get(event.flashcardId) ?? [];
    events.push(event);
    eventsByCardId.set(event.flashcardId, events);
  }

  const masteries = activeCardIds.map((flashcardId) => {
    const events = eventsByCardId.get(flashcardId) ?? [];
    pipelineTrace?.derivedMasteryCardIds.push(flashcardId);
    const mastery = {
      flashcardId,
      ...deriveFlashcardMastery(events, evaluationTime),
    };
    pipelineTrace?.derivations.push({
      flashcardId,
      eventCount: events.length,
      status: mastery.status,
    });
    return mastery;
  });
  pipelineTrace?.returnedMasteryCardIds.push(...masteries.map((mastery) => mastery.flashcardId));
  return masteries;
}
