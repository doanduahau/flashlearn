import type {
  ActiveFlashcardMastery,
  SmartReviewCandidate,
  SmartReviewCandidateResult,
} from "@/features/mastery/types/mastery-types";

function isSmartReviewCandidate(
  mastery: ActiveFlashcardMastery,
): mastery is ActiveFlashcardMastery & {
  status: "review";
  score: number;
  lastReviewedAt: string;
} {
  // Keep the eligibility rule in one domain boundary so a future scheduler can
  // replace it without teaching every caller about Mastery V1 internals.
  return mastery.status === "review" && mastery.score !== null && mastery.lastReviewedAt !== null;
}

function compareCandidates(left: SmartReviewCandidate, right: SmartReviewCandidate): number {
  if (left.score !== right.score) return left.score - right.score;
  if (left.lastReviewedAt !== right.lastReviewedAt) {
    return left.lastReviewedAt < right.lastReviewedAt ? -1 : 1;
  }
  if (left.flashcardId === right.flashcardId) return 0;
  return left.flashcardId < right.flashcardId ? -1 : 1;
}

function normalizeLimit(limit: number | undefined): number | undefined {
  if (limit === undefined) return undefined;
  return Math.max(0, Math.floor(limit));
}

export function selectSmartReviewCandidates(
  masteries: readonly ActiveFlashcardMastery[],
  limit?: number,
): SmartReviewCandidateResult {
  const ranked = masteries
    .filter(isSmartReviewCandidate)
    .map(({ flashcardId, status, score, lastReviewedAt }) => ({
      flashcardId,
      status,
      score,
      lastReviewedAt,
    }))
    .sort(compareCandidates);

  const normalizedLimit = normalizeLimit(limit);
  return {
    total: ranked.length,
    candidates: normalizedLimit === undefined ? ranked : ranked.slice(0, normalizedLimit),
  };
}
