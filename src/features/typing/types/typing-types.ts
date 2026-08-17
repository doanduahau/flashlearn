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
  setId: string;
  front: string;
  back: string;
  userAnswer: string;
  isCorrect: boolean;
};

export type TypingCollectionOption = {
  id: string;
  name: string;
};

export type TypingSubmitResult = {
  correctCount: number;
  totalCount: number;
  questions: TypingQuestionResult[];
  collections: TypingCollectionOption[];
  membershipsByCard: Record<string, string[]>;
};

export type TypingAvailability = {
  eligibleCount: number;
  availableCounts: number[];
};
