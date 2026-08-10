import type { SmartReviewCandidateResult } from "@/features/mastery/types/mastery-types";
import type { FsrsTransitionQueue } from "@/features/spaced-repetition/utils/transition-queue";

export const SMART_REVIEW_BATCH_SIZE = 10;

/** @deprecated — replaced by `smartReviewTargetCardIdsFromTransitionQueue`. Kept for rollbackability. */
export function smartReviewTargetCardIds(candidates: SmartReviewCandidateResult): string[] {
  return candidates.candidates
    .slice(0, SMART_REVIEW_BATCH_SIZE)
    .map((candidate) => candidate.flashcardId);
}

export function smartReviewTargetCardIdsFromTransitionQueue(queue: FsrsTransitionQueue): string[] {
  return queue.candidates.map((c) => c.candidate.flashcardId);
}
