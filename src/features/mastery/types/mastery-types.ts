export type MasteryStatus = "untested" | "review" | "learning" | "strong";

export type CardReviewOutcome = {
  isCorrect: boolean | null;
  reviewedAt: string;
};

export type FlashcardMastery = {
  status: MasteryStatus;
  score: number | null;
  reviewCount: number;
  correctCount: number;
  incorrectCount: number;
  lastReviewedAt: string | null;
};

export type ActiveFlashcardMastery = FlashcardMastery & {
  flashcardId: string;
};

/**
 * A deliberately small, ranked projection for the next Smart Review surface.
 * Card content is intentionally omitted so callers can fetch a selected batch in
 * one query when a future session needs it.
 */
export type SmartReviewCandidate = {
  flashcardId: string;
  status: "review";
  score: number;
  lastReviewedAt: string;
};

export type SmartReviewCandidateResult = {
  total: number;
  candidates: SmartReviewCandidate[];
};

export interface CardMasteryRepository {
  findActiveCardIds(cardIds: readonly string[]): Promise<string[]>;
  findReviewEvents(cardIds: readonly string[]): Promise<CardReviewEventRow[]>;
}

export type CardReviewEventRow = {
  flashcardId: string;
  isCorrect: boolean | null;
  reviewedAt: string;
};

/**
 * Optional, read-only instrumentation for the shared Mastery loading pipeline.
 * It intentionally retains identifiers only so diagnostic code can determine
 * where a card leaves the real pipeline without repeating repository queries.
 */
export type MasteryPipelineTrace = {
  scopedCardIds: string[];
  requestedCardIds: string[];
  activeCardIds: string[];
  reviewEventCardIds: string[];
  derivedMasteryCardIds: string[];
  returnedMasteryCardIds: string[];
  snapshotMasteryCardIds: string[];
};

export function createMasteryPipelineTrace(): MasteryPipelineTrace {
  return {
    scopedCardIds: [],
    requestedCardIds: [],
    activeCardIds: [],
    reviewEventCardIds: [],
    derivedMasteryCardIds: [],
    returnedMasteryCardIds: [],
    snapshotMasteryCardIds: [],
  };
}
