export type MemoryCard = {
  id: string;
  front: string;
  back: string;
};

export type MemorySide = "front" | "back";

export type MemoryTile = {
  key: string;
  cardId: string;
  side: MemorySide;
  content: string;
};

export type MemoryBatch = {
  tiles: MemoryTile[];
};

export type MemoryQuestionCount = 12 | 18 | 24;

export const MEMORY_PAIR_COUNT = 6 as const;

export const MEMORY_QUESTION_COUNTS: readonly MemoryQuestionCount[] = [12, 18, 24];

export type StartedMemorySession = {
  coverageSessionId: string;
  batches: MemoryBatch[];
  selectedCount: number;
  eligibleCount: number;
};
