import type { QuizSessionOrigin } from "@/features/quiz/utils/quiz-session-origin";

export type SmartReviewResultContext =
  { kind: "manual" } | { kind: "smart_review"; remainingCount: number };

/**
 * A completed Smart Review must derive its continuation from a fresh FSRS due count.
 * Manual quiz results deliberately skip this potentially full-library read.
 */
export async function loadSmartReviewResultContext(
  origin: QuizSessionOrigin,
  loadDueCount: () => Promise<{ total: number }>,
): Promise<SmartReviewResultContext> {
  if (origin !== "smart_review") return { kind: "manual" };

  const result = await loadDueCount();
  return {
    kind: "smart_review",
    remainingCount: result.total,
  };
}
