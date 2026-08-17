import type { MatchBatch } from "../types/match-types";

export type MatchSide = "front" | "back";

export type MatchState = {
  batches: MatchBatch[];
  currentBatchIndex: number;
  selectedFrontId: string | null;
  selectedBackId: string | null;
  lastResult: "none" | "correct" | "incorrect";
  completedPairCount: number;
  incorrectAttemptCount: number;
  matchedFrontIds: Set<string>;
  matchedBackIds: Set<string>;
  /** Card ids matched correctly at any point in the whole session. */
  correctCardIds: string[];
  /** Card ids that were part of a wrong pair at any point in the session. */
  wrongCardIds: string[];
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
    incorrectAttemptCount: 0,
    matchedFrontIds: new Set(),
    matchedBackIds: new Set(),
    correctCardIds: [],
    wrongCardIds: [],
  };
}

export function currentBatch(state: MatchState): MatchBatch {
  return state.batches[state.currentBatchIndex];
}

export function completedCount(state: MatchState): number {
  return state.completedPairCount;
}

export function incorrectAttemptCountOf(state: MatchState): number {
  return state.incorrectAttemptCount;
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
 * selection and any match resolution that results. A pair is resolved whenever
 * exactly one Front and one Back are selected, regardless of click order.
 */
export function selectCard(state: MatchState, side: MatchSide, cardId: string): MatchState {
  if (phaseOf(state) === "completed") return state;

  const frontMatched = state.matchedFrontIds.has(cardId);
  const backMatched = state.matchedBackIds.has(cardId);
  if (side === "front" && frontMatched) return state;
  if (side === "back" && backMatched) return state;

  const copy: MatchState = {
    ...state,
    lastResult: "none",
    matchedFrontIds: new Set(state.matchedFrontIds),
    matchedBackIds: new Set(state.matchedBackIds),
    correctCardIds: [...state.correctCardIds],
    wrongCardIds: [...state.wrongCardIds],
  };

  if (side === "front") {
    // A Back is already selected -> resolve this Front against it.
    if (state.selectedBackId !== null) {
      return resolvePair(copy, cardId, state.selectedBackId);
    }
    copy.selectedFrontId = state.selectedFrontId === cardId ? null : cardId;
    return copy;
  }

  // side === "back"
  if (state.selectedFrontId === null) {
    copy.selectedBackId = state.selectedBackId === cardId ? null : cardId;
    return copy;
  }

  return resolvePair(copy, state.selectedFrontId, cardId);
}

function resolvePair(state: MatchState, frontId: string, backId: string): MatchState {
  const batch = currentBatch(state);
  const frontCard = batch.fronts.find((card) => card.id === frontId);
  const backCard = batch.backs.find((card) => card.id === backId);
  if (!frontCard || !backCard) {
    state.selectedFrontId = null;
    state.selectedBackId = null;
    return state;
  }

  const isCorrect = frontCard.id === backCard.id;
  state.selectedFrontId = null;
  state.selectedBackId = null;
  state.lastResult = isCorrect ? "correct" : "incorrect";

  if (isCorrect) {
    state.matchedFrontIds.add(frontCard.id);
    state.matchedBackIds.add(backCard.id);
    state.completedPairCount = state.completedPairCount + 1;
    pushUnique(state.correctCardIds, frontCard.id);
    pushUnique(state.correctCardIds, backCard.id);

    // Automatically advance to the next batch once all six pairs are matched.
    if (state.matchedFrontIds.size === batch.fronts.length) {
      return advanceBatch(state);
    }
  } else {
    state.incorrectAttemptCount = state.incorrectAttemptCount + 1;
    pushUnique(state.wrongCardIds, frontId);
    pushUnique(state.wrongCardIds, backId);
  }

  return state;
}

function pushUnique(ids: string[], id: string): void {
  if (!ids.includes(id)) ids.push(id);
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
    // correctCardIds / wrongCardIds intentionally persist across batches so
    // the completion payload covers the whole session.
  };
}

export function buildReplay(state: MatchState, freshBatches: MatchBatch[]): MatchState {
  return createMatchState(freshBatches);
}
