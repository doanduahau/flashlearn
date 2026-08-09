import type { CardMasteryRepository } from "@/features/mastery/types/mastery-types";
import {
  aggregateMastery,
  EMPTY_MASTERY_AGGREGATE,
  type MasteryAggregate,
} from "@/features/mastery/utils/aggregate-mastery";
import { loadCardMasteriesWithRepository } from "@/features/mastery/utils/load-card-masteries";

export interface MasteryScopeRepository extends CardMasteryRepository {
  findActiveCardIdsInScope(): Promise<string[]>;
}

export async function loadMasteryAggregateWithRepository(
  repository: MasteryScopeRepository,
  evaluationTime: string,
): Promise<MasteryAggregate> {
  const cardIds = await repository.findActiveCardIdsInScope();
  if (cardIds.length === 0) return EMPTY_MASTERY_AGGREGATE;

  const masteries = await loadCardMasteriesWithRepository(repository, cardIds, evaluationTime);
  return aggregateMastery(masteries);
}
