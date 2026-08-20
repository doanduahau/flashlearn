import "server-only";

import type {
  GeminiTypingBatchReviewer,
  TypingReviewItem,
} from "@/features/typing/server/gemini-answer-check";
import { isAnswerCorrect } from "@/features/typing/utils/answer-match";

export type BatchGradeResult = Readonly<{
  results: Array<{ id: string; correct: boolean }>;
  locallyCorrect: number;
  reviewed: number;
  degraded: boolean;
}>;

/** Local-first batch grading; any provider/mapping failure keeps all local misses wrong. */
export async function gradeTypingAnswersBatch(
  items: readonly TypingReviewItem[],
  reviewer: Pick<GeminiTypingBatchReviewer, "review">,
): Promise<BatchGradeResult> {
  const resultById = new Map<string, boolean>();
  const reviewItems: TypingReviewItem[] = [];
  let locallyCorrect = 0;

  for (const item of items) {
    const correct = isAnswerCorrect(item.userAnswer, item.correctAnswer);
    resultById.set(item.id, correct);
    if (correct) locallyCorrect += 1;
    else reviewItems.push(item);
  }

  if (reviewItems.length === 0) {
    return {
      results: items.map((item) => ({ id: item.id, correct: true })),
      locallyCorrect,
      reviewed: 0,
      degraded: false,
    };
  }

  try {
    const reviewed = await reviewer.review(reviewItems);
    for (const result of reviewed) resultById.set(result.id, result.correct);
    return {
      results: items.map((item) => ({ id: item.id, correct: resultById.get(item.id) ?? false })),
      locallyCorrect,
      reviewed: reviewItems.length,
      degraded: false,
    };
  } catch {
    return {
      results: items.map((item) => ({ id: item.id, correct: resultById.get(item.id) ?? false })),
      locallyCorrect,
      reviewed: 0,
      degraded: true,
    };
  }
}

export function localTypingMisses(items: readonly TypingReviewItem[]): TypingReviewItem[] {
  return items.filter((item) => !isAnswerCorrect(item.userAnswer, item.correctAnswer));
}
