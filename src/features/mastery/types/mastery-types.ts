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

export interface CardMasteryRepository {
  findActiveCardIds(cardIds: readonly string[]): Promise<string[]>;
  findReviewEvents(cardIds: readonly string[]): Promise<CardReviewEventRow[]>;
}

export type CardReviewEventRow = {
  flashcardId: string;
  isCorrect: boolean | null;
  reviewedAt: string;
};
