import type { FsrsDueCandidateResult } from "@/features/spaced-repetition/types/due-types";

export const SMART_REVIEW_BATCH_SIZE = 10;

export function smartReviewTargetCardIds(dueResult: FsrsDueCandidateResult): string[] {
  return dueResult.candidates.map((candidate) => candidate.flashcardId);
}
