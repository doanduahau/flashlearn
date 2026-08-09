export const FSR_SCHEDULER_IDENTITY = {
  algorithm: "fsrs-6",
  implementation: "ts-fsrs@5.4.1",
  parameterSet: "flashlearn-v1",
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
