import type { MemoryBatch, MemoryTile } from "../types/memory-types";

export type MemoryPhase = "playing" | "mismatch" | "celebration" | "completed";

export type MemoryState = {
  batches: MemoryBatch[];
  currentBatchIndex: number;
  firstKey: string | null;
  secondKey: string | null;
  phase: MemoryPhase;
  matchedKeys: Set<string>;
  completedCount: number;
};

export const MISMATCH_DELAY_MS = 1000;
export const CELEBRATION_DELAY_MS = 700;

export function createMemoryState(batches: MemoryBatch[]): MemoryState {
  return {
    batches,
    currentBatchIndex: 0,
    firstKey: null,
    secondKey: null,
    phase: "playing",
    matchedKeys: new Set(),
    completedCount: 0,
  };
}

export function currentBatch(state: MemoryState): MemoryBatch {
  return state.batches[state.currentBatchIndex];
}

export function isTileMatched(state: MemoryState, key: string): boolean {
  return state.matchedKeys.has(key);
}

export function isTileFlipped(state: MemoryState, key: string): boolean {
  return key === state.firstKey || key === state.secondKey;
}

export function previewTile(state: MemoryState): MemoryTile | null {
  const batch = currentBatch(state);
  const key = state.secondKey ?? state.firstKey;
  if (!key) return null;
  return batch.tiles.find((tile) => tile.key === key) ?? null;
}

export function isBatchComplete(state: MemoryState): boolean {
  const batch = currentBatch(state);
  return batch.tiles.every((tile) => state.matchedKeys.has(tile.key));
}

/**
 * Resolves the second tap. A pair is correct when the two tiles share a
 * flashcard id but differ in side, independent of their text content.
 */
export function tapTile(state: MemoryState, key: string): MemoryState {
  if (state.phase !== "playing") return state;
  if (state.matchedKeys.has(key)) return state;

  const batch = currentBatch(state);
  const tile = batch.tiles.find((candidate) => candidate.key === key);
  if (!tile) return state;

  // First selection.
  if (state.firstKey === null) {
    return { ...state, firstKey: key, secondKey: null };
  }

  // Tapping the same first tile again is not a second choice.
  if (state.firstKey === key) return state;

  const first = batch.tiles.find((candidate) => candidate.key === state.firstKey);
  if (!first) return { ...state, firstKey: key, secondKey: null };

  const matched = first.cardId === tile.cardId && first.side !== tile.side;

  if (matched) {
    const matchedKeys = new Set(state.matchedKeys);
    matchedKeys.add(first.key);
    matchedKeys.add(tile.key);
    const completedCount = state.completedCount + 1;
    const batchComplete = batch.tiles.every((candidate) => matchedKeys.has(candidate.key));
    const finalBatch = state.currentBatchIndex === state.batches.length - 1;

    if (batchComplete && finalBatch) {
      return {
        ...state,
        firstKey: null,
        secondKey: null,
        phase: "completed",
        matchedKeys,
        completedCount,
      };
    }

    return {
      ...state,
      firstKey: null,
      secondKey: null,
      phase: "celebration",
      matchedKeys,
      completedCount,
    };
  }

  return { ...state, firstKey: state.firstKey, secondKey: key, phase: "mismatch" };
}

/** Called after the mismatch one-second delay; both tiles flip back down. */
export function resolveMismatch(state: MemoryState): MemoryState {
  if (state.phase !== "mismatch") return state;
  return { ...state, firstKey: null, secondKey: null, phase: "playing" };
}

/** Called after the celebration delay; advances the batch when complete. */
export function resolveCelebration(state: MemoryState): MemoryState {
  if (state.phase !== "celebration") return state;
  if (isBatchComplete(state)) {
    const nextIndex = state.currentBatchIndex + 1;
    if (nextIndex >= state.batches.length) {
      return { ...state, currentBatchIndex: nextIndex, phase: "completed" };
    }
    return { ...state, currentBatchIndex: nextIndex, phase: "playing" };
  }
  return { ...state, phase: "playing" };
}
