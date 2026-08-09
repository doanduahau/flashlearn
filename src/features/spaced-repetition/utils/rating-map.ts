import { Rating } from "ts-fsrs";

import type { ReviewReplayFact } from "../types/spaced-repetition-types";

export type SchedulableRating = Exclude<Rating, Rating.Manual>;

export type QuizRating = Rating.Good | Rating.Again;

export function quizRating(isCorrect: boolean): QuizRating {
  return isCorrect ? Rating.Good : Rating.Again;
}

export function ratingForReviewFact(fact: ReviewReplayFact): SchedulableRating | null {
  if (fact.fsrsRating != null) {
    const stored = Number(fact.fsrsRating);
    if (
      stored === Rating.Again ||
      stored === Rating.Hard ||
      stored === Rating.Good ||
      stored === Rating.Easy
    ) {
      return stored;
    }
  }
  if (fact.isCorrect === true) return Rating.Good;
  if (fact.isCorrect === false) return Rating.Again;
  return null;
}
