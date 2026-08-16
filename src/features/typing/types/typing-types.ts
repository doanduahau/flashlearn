export type TypingCard = {
  id: string;
  front: string;
  back: string;
};

export type StartedTypingSession = {
  coverageSessionId: string;
  cards: TypingCard[];
  selectedCount: number;
  eligibleCount: number;
};

export type TypingQuestionResult = {
  flashcardId: string;
  front: string;
  back: string;
  userAnswer: string;
  isCorrect: boolean;
};

export type TypingSubmitResult = {
  correctCount: number;
  totalCount: number;
  questions: TypingQuestionResult[];
};

export type TypingAvailability = {
  eligibleCount: number;
  availableCounts: number[];
};
