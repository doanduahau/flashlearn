import type { SmartReviewCandidateResult } from "@/features/mastery/types/mastery-types";

export const SMART_REVIEW_BATCH_SIZE = 10;

export function smartReviewTargetCardIds(candidates: SmartReviewCandidateResult): string[] {
  return candidates.candidates
    .slice(0, SMART_REVIEW_BATCH_SIZE)
    .map((candidate) => candidate.flashcardId);
}
