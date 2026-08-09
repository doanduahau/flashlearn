import type { FsrsDueCandidate } from "@/features/spaced-repetition/types/due-types";

export type DueCandidateInput = {
  flashcardId: string;
  due: string;
  lastReview: string | null;
  state: number;
};

/**
 * FSRS due eligibility for V1: an existing schedule whose `due` is at or
 * before the single fixed evaluation timestamp. Never uses profile timezone.
 */
export function isDueForReview(candidate: DueCandidateInput, evaluationTime: string): boolean {
  return Date.parse(candidate.due) <= Date.parse(evaluationTime);
}

export function compareDueCandidates(left: DueCandidateInput, right: DueCandidateInput): number {
  const dueDelta = Date.parse(left.due) - Date.parse(right.due);
  if (dueDelta !== 0) return dueDelta;

  const leftLast = left.lastReview === null ? null : Date.parse(left.lastReview);
  const rightLast = right.lastReview === null ? null : Date.parse(right.lastReview);
  if (leftLast !== rightLast) {
    if (leftLast === null) return -1;
    if (rightLast === null) return 1;
    return leftLast - rightLast;
  }

  if (left.flashcardId !== right.flashcardId) {
    return left.flashcardId < right.flashcardId ? -1 : 1;
  }
  return 0;
}

export function normalizeDueLimit(limit: number | undefined): number | undefined {
  if (limit === undefined) return undefined;
  return Math.max(0, Math.floor(limit));
}

/**
 * Filter to due candidates, apply the canonical deterministic ordering
 * (due ASC, last_review ASC, flashcard_id ASC), then apply the limit.
 */
export function selectDueCandidates(
  candidates: readonly DueCandidateInput[],
  evaluationTime: string,
  limit?: number,
): FsrsDueCandidate[] {
  const due = candidates.filter((candidate) => isDueForReview(candidate, evaluationTime));
  const ordered = [...due].sort(compareDueCandidates);
  const normalizedLimit = normalizeDueLimit(limit);
  return normalizedLimit === undefined ? ordered : ordered.slice(0, normalizedLimit);
}
