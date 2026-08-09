import type { MasterySnapshot } from "@/features/mastery/utils/load-mastery-snapshot";
import type { QuizSessionOrigin } from "@/features/quiz/utils/quiz-session-origin";

export type SmartReviewResultContext =
  { kind: "manual" } | { kind: "smart_review"; remainingCount: number };

/**
 * A completed Smart Review must derive its continuation from a new snapshot.
 * Manual quiz results deliberately skip this potentially full-library read.
 */
export async function loadSmartReviewResultContext(
  origin: QuizSessionOrigin,
  loadSnapshot: () => Promise<Pick<MasterySnapshot, "reviewCandidates">>,
): Promise<SmartReviewResultContext> {
  if (origin !== "smart_review") return { kind: "manual" };

  const snapshot = await loadSnapshot();
  return {
    kind: "smart_review",
    remainingCount: snapshot.reviewCandidates.total,
  };
}
