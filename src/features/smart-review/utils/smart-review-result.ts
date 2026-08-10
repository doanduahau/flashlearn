import type { QuizSessionOrigin } from "@/features/quiz/utils/quiz-session-origin";

export type SmartReviewResultContext =
  | { kind: "manual" }
  | { kind: "smart_review"; remainingCount: number }
  | { kind: "new_cards"; remainingCount: number };

export async function loadSmartReviewResultContext(
  origin: QuizSessionOrigin,
  loadDueCount: () => Promise<{ total: number }>,
  loadNewCardsCount?: () => Promise<{ total: number }>,
): Promise<SmartReviewResultContext> {
  if (origin === "smart_review") {
    const result = await loadDueCount();
    return { kind: "smart_review", remainingCount: result.total };
  }
  if (origin === "new_cards" && loadNewCardsCount) {
    const result = await loadNewCardsCount();
    return { kind: "new_cards", remainingCount: result.total };
  }
  return { kind: "manual" };
}
