import type { FsrsTransitionQueue } from "@/features/spaced-repetition/utils/transition-queue";
import type { QuizSessionOrigin } from "@/features/quiz/utils/quiz-session-origin";

export type SmartReviewResultContext =
  { kind: "manual" } | { kind: "smart_review"; remainingCount: number };

/**
 * A completed Smart Review must derive its continuation from a new transition queue.
 * Manual quiz results deliberately skip this potentially full-library read.
 */
export async function loadSmartReviewResultContext(
  origin: QuizSessionOrigin,
  loadQueue: () => Promise<Pick<FsrsTransitionQueue, "actionableNow">>,
): Promise<SmartReviewResultContext> {
  if (origin !== "smart_review") return { kind: "manual" };

  const queue = await loadQueue();
  return {
    kind: "smart_review",
    remainingCount: queue.actionableNow,
  };
}
