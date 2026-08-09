import type {
  ActiveFlashcardMastery,
  CardMasteryRepository,
  SmartReviewCandidateResult,
} from "@/features/mastery/types/mastery-types";
import {
  aggregateMastery,
  type MasteryAggregate,
} from "@/features/mastery/utils/aggregate-mastery";
import { loadCardMasteriesWithRepository } from "@/features/mastery/utils/load-card-masteries";
import { selectSmartReviewCandidates } from "@/features/mastery/utils/select-smart-review-candidates";

export interface MasteryScopeRepository extends CardMasteryRepository {
  findActiveCardIdsInScope(): Promise<string[]>;
}

export type MasterySnapshot = {
  evaluationTime: string;
  masteries: ActiveFlashcardMastery[];
  aggregate: MasteryAggregate;
  reviewCandidates: SmartReviewCandidateResult;
};

export async function loadMasterySnapshotWithRepository(
  repository: MasteryScopeRepository,
  evaluationTime: string,
  reviewCandidateLimit?: number,
): Promise<MasterySnapshot> {
  const scopedCardIds = await repository.findActiveCardIdsInScope();
  const masteries = await loadCardMasteriesWithRepository(
    repository,
    scopedCardIds,
    evaluationTime,
  );

  return {
    evaluationTime,
    masteries,
    aggregate: aggregateMastery(masteries),
    reviewCandidates: selectSmartReviewCandidates(masteries, reviewCandidateLimit),
  };
}
