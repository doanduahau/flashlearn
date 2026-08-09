import { createEmptyCard, State, type Card, type FSRS } from "ts-fsrs";

import type {
  FsrSchedulingState,
  FsrStateName,
  ReviewReplayFact,
} from "../types/spaced-repetition-types";
import { ratingForReviewFact, type SchedulableRating } from "./rating-map";

function compareReviewFacts(left: ReviewReplayFact, right: ReviewReplayFact): number {
  const leftTime = Date.parse(left.reviewedAt);
  const rightTime = Date.parse(right.reviewedAt);
  if (leftTime !== rightTime) return leftTime - rightTime;
  if (left.eventId !== right.eventId) return left.eventId < right.eventId ? -1 : 1;
  return 0;
}

function stateToName(state: State): FsrStateName {
  switch (state) {
    case State.Learning:
      return "Learning";
    case State.Review:
      return "Review";
    case State.Relearning:
      return "Relearning";
    default:
      return "New";
  }
}

function toSchedulingState(card: Card): FsrSchedulingState {
  return {
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    state: stateToName(card.state),
    scheduledDays: card.scheduled_days,
    learningSteps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    lastReview: card.last_review ? card.last_review.toISOString() : null,
  };
}

export function replayReviewHistory(
  events: readonly ReviewReplayFact[],
  scheduler: FSRS,
): FsrSchedulingState | null {
  const ordered = [...events].sort(compareReviewFacts);

  const schedulable: Array<{ fact: ReviewReplayFact; rating: SchedulableRating }> = [];
  for (const fact of ordered) {
    const rating = ratingForReviewFact(fact);
    if (rating === null) continue;
    schedulable.push({ fact, rating });
  }
  if (schedulable.length === 0) return null;

  let card: Card = createEmptyCard(new Date(schedulable[0].fact.reviewedAt));
  for (const { fact, rating } of schedulable) {
    card = scheduler.next(card, new Date(fact.reviewedAt), rating).card;
  }

  return toSchedulingState(card);
}
