import type { MatchBatch } from "../types/match-types";

export type MatchSide = "front" | "back";

export type MatchState = {
  batches: MatchBatch[];
  currentBatchIndex: number;
  selectedFrontId: string | null;
  selectedBackId: string | null;
  lastResult: "none" | "correct" | "incorrect";
  completedPairCount: number;
  matchedFrontIds: Set<string>;
  matchedBackIds: Set<string>;
};

export type MatchPhase = "playing" | "completed";

export function createMatchState(batches: MatchBatch[]): MatchState {
  return {
    batches,
    currentBatchIndex: 0,
    selectedFrontId: null,
    selectedBackId: null,
    lastResult: "none",
    completedPairCount: 0,
    matchedFrontIds: new Set(),
    matchedBackIds: new Set(),
  };
}

export function currentBatch(state: MatchState): MatchBatch {
  return state.batches[state.currentBatchIndex];
}

export function completedCount(state: MatchState): number {
  return state.completedPairCount;
}

export function isPairMatched(state: MatchState, frontId: string, backId: string): boolean {
  return state.matchedFrontIds.has(frontId) && state.matchedBackIds.has(backId);
}

export function isBatchComplete(state: MatchState): boolean {
  const batch = currentBatch(state);
  return batch.fronts.every((card) => state.matchedFrontIds.has(card.id));
}

export function phaseOf(state: MatchState): MatchPhase {
  return state.currentBatchIndex >= state.batches.length ? "completed" : "playing";
}

/**
 * Selects a Front or Back card. Returns a new state (immutable) reflecting the
 * selection and any match resolution that results.
 */
export function selectCard(state: MatchState, side: MatchSide, cardId: string): MatchState {
  if (phaseOf(state) === "completed") return state;

  const batch = currentBatch(state);
  const frontMatched = state.matchedFrontIds.has(cardId);
  const backMatched = state.matchedBackIds.has(cardId);
  if (side === "front" && frontMatched) return state;
  if (side === "back" && backMatched) return state;

  const copy: MatchState = {
    ...state,
    lastResult: "none",
    matchedFrontIds: new Set(state.matchedFrontIds),
    matchedBackIds: new Set(state.matchedBackIds),
  };

  if (side === "front") {
    copy.selectedFrontId = state.selectedFrontId === cardId ? null : cardId;
    copy.selectedBackId = null;
    return copy;
  }

  // side === "back"
  if (state.selectedFrontId === null) {
    copy.selectedBackId = state.selectedBackId === cardId ? null : cardId;
    return copy;
  }

  const frontCard = batch.fronts.find((card) => card.id === state.selectedFrontId);
  const backCard = batch.backs.find((card) => card.id === cardId);
  if (!frontCard || !backCard) {
    copy.selectedFrontId = null;
    copy.selectedBackId = null;
    return copy;
  }

  const isCorrect = frontCard.id === backCard.id;
  copy.selectedFrontId = null;
  copy.selectedBackId = null;
  copy.lastResult = isCorrect ? "correct" : "incorrect";

  if (isCorrect) {
    copy.matchedFrontIds.add(frontCard.id);
    copy.matchedBackIds.add(backCard.id);
    copy.completedPairCount = state.completedPairCount + 1;

    // Automatically advance to the next batch once all six pairs are matched.
    if (copy.matchedFrontIds.size === batch.fronts.length) {
      return advanceBatch(copy);
    }
  }

  return copy;
}

/**
 * Advances to the next batch once the current batch is complete. Returns a
 * state with incremented batch index and reset selections.
 */
export function advanceBatch(state: MatchState): MatchState {
  return {
    ...state,
    currentBatchIndex: state.currentBatchIndex + 1,
    selectedFrontId: null,
    selectedBackId: null,
    lastResult: "none",
    matchedFrontIds: new Set(),
    matchedBackIds: new Set(),
  };
}

export function buildReplay(state: MatchState, freshBatches: MatchBatch[]): MatchState {
  return createMatchState(freshBatches);
}
