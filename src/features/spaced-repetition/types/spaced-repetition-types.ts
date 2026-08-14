export const FSR_SCHEDULER_IDENTITY = {
  algorithm: "fsrs-6",
  implementation: "ts-fsrs@5.4.1",
  parameterSet: "capystudy-v1",
} as const;

export type FsrSchedulerIdentity = typeof FSR_SCHEDULER_IDENTITY;

export type FsrStateName = "New" | "Learning" | "Review" | "Relearning";

export type FsrSchedulingState = {
  due: string;
  stability: number;
  difficulty: number;
  state: FsrStateName;
  scheduledDays: number;
  learningSteps: number;
  reps: number;
  lapses: number;
  lastReview: string | null;
};

export type ReviewReplayFact = {
  eventId: string;
  reviewedAt: string;
  isCorrect: boolean | null;
  fsrsRating?: number | null;
};

export type ScheduleRow = {
  state: number;
  stability: number;
  difficulty: number;
  due: string;
  scheduledDays: number;
  learningSteps: number;
  reps: number;
  lapses: number;
  lastReview: string;
  projectionRevision: number;
  processedEventCount: number;
  lastProcessedReviewedAt: string;
  lastProcessedReviewEventId: string;
  algorithm: string;
  implementation: string;
  parameterSet: string;
  updatedAt: string;
};

export type SchedulableEventRow = {
  id: string;
  reviewedAt: string;
  isCorrect: boolean | null;
  fsrsRating: number | null;
};

/**
 * PostgREST predicate for "schedulable" review events:
 *   (fsrs_rating BETWEEN 1 AND 4) OR (is_correct IS NOT NULL)
 * Shared by the repository, local runner and integration tests so the
 * TypeScript predicate and database predicate stay aligned.
 */
export const SCHEDULABLE_EVENT_OR_PREDICATE =
  "and(fsrs_rating.gte.1,fsrs_rating.lte.4),is_correct.not.is.null";

export function isSchedulableEventRow(row: SchedulableEventRow): boolean {
  if (row.fsrsRating !== null && row.fsrsRating >= 1 && row.fsrsRating <= 4) return true;
  return row.isCorrect !== null;
}
