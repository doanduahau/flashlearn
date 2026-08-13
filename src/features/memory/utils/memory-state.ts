import type { MemoryBatch, MemoryTile } from "../types/memory-types";

export type MemoryPhase = "playing" | "correct-pending" | "mismatch" | "celebration" | "completed";

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
export const CORRECT_REVIEW_DELAY_MS = 1000;
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
    // A correct pair first enters a review window: both tiles stay flipped and
    // the preview keeps showing the second tile for exactly one second before
    // the pair is resolved.
    return { ...state, firstKey: first.key, secondKey: tile.key, phase: "correct-pending" };
  }

  return { ...state, firstKey: state.firstKey, secondKey: key, phase: "mismatch" };
}

/** Called after the correct-pair review delay; marks the pair as resolved. */
export function resolveCorrectPair(state: MemoryState): MemoryState {
  if (state.phase !== "correct-pending") return state;
  if (state.firstKey === null || state.secondKey === null) {
    return { ...state, firstKey: null, secondKey: null, phase: "playing" };
  }

  const matchedKeys = new Set(state.matchedKeys);
  matchedKeys.add(state.firstKey);
  matchedKeys.add(state.secondKey);
  const completedCount = state.completedCount + 1;

  return {
    ...state,
    firstKey: null,
    secondKey: null,
    phase: "celebration",
    matchedKeys,
    completedCount,
  };
}

/**
 * True when the pending correct pair would complete the final batch. The
 * session timer stops at this logical match moment, not after the one-second
 * review delay or the celebration.
 */
export function isFinalPendingPair(state: MemoryState): boolean {
  if (state.phase !== "correct-pending") return false;
  if (state.firstKey === null || state.secondKey === null) return false;
  const matchedKeys = new Set(state.matchedKeys);
  matchedKeys.add(state.firstKey);
  matchedKeys.add(state.secondKey);
  const batchComplete = currentBatch(state).tiles.every((candidate) =>
    matchedKeys.has(candidate.key),
  );
  return batchComplete && state.currentBatchIndex === state.batches.length - 1;
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
    if (state.currentBatchIndex >= state.batches.length - 1) {
      return { ...state, phase: "completed" };
    }
    return { ...state, currentBatchIndex: state.currentBatchIndex + 1, phase: "playing" };
  }
  return { ...state, phase: "playing" };
}
