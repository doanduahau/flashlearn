import { describe, expect, it } from "vitest";

import type { MatchBatch, MatchCard } from "@/features/match/types/match-types";
import { createMatchState, phaseOf, selectCard } from "@/features/match/utils/match-state";

function card(id: string): MatchCard {
  return { id, front: `front-${id}`, back: `back-${id}` };
}

function makeBatch(ids: string[]): MatchBatch {
  return { fronts: ids.map(card), backs: ids.map(card) };
}

describe("match state machine", () => {
  it("marks exactly the two corresponding cards matched on a correct selection", () => {
    const batch = makeBatch(["a", "b", "c", "d", "e", "f"]);
    const state = createMatchState([batch]);

    const afterSelectFront = selectCard(state, "front", "a");
    expect(afterSelectFront.selectedFrontId).toBe("a");

    const afterMatch = selectCard(afterSelectFront, "back", "a");
    expect(afterMatch.matchedFrontIds.has("a")).toBe(true);
    expect(afterMatch.matchedBackIds.has("a")).toBe(true);
    expect(afterMatch.matchedFrontIds.size).toBe(1);
    expect(afterMatch.matchedBackIds.size).toBe(1);
  });

  it("does not mark either card matched on an incorrect selection", () => {
    const batch = makeBatch(["a", "b", "c", "d", "e", "f"]);
    const state = createMatchState([batch]);

    const withFront = selectCard(state, "front", "a");
    const afterWrong = selectCard(withFront, "back", "b");
    expect(afterWrong.matchedFrontIds.has("a")).toBe(false);
    expect(afterWrong.matchedBackIds.has("b")).toBe(false);
    expect(afterWrong.lastResult).toBe("incorrect");
    expect(afterWrong.selectedFrontId).toBeNull();
    expect(afterWrong.selectedBackId).toBeNull();
  });

  it("a matched pair cannot be matched again", () => {
    const batch = makeBatch(["a", "b", "c", "d", "e", "f"]);
    const state = createMatchState([batch]);
    const matched = selectCard(selectCard(state, "front", "a"), "back", "a");
    const again = selectCard(matched, "front", "a");
    // Select on a matched front is ignored.
    expect(again.selectedFrontId).toBeNull();
    expect(again.matchedFrontIds.has("a")).toBe(true);
  });

  it("automatically advances to the next batch after six correct pairs", () => {
    const batch1 = makeBatch(["a", "b", "c", "d", "e", "f"]);
    const batch2 = makeBatch(["g", "h", "i", "j", "k", "l"]);
    const state = createMatchState([batch1, batch2]);

    let current = state;
    for (const id of ["a", "b", "c", "d", "e", "f"]) {
      current = selectCard(current, "front", id);
      current = selectCard(current, "back", id);
    }
    // Matching the sixth pair automatically advanced to batch 2.
    expect(current.currentBatchIndex).toBe(1);
    expect(current.matchedFrontIds.size).toBe(0);
    expect(current.selectedFrontId).toBeNull();
  });

  it("session becomes completed after the final batch", () => {
    const batch1 = makeBatch(["a", "b", "c", "d", "e", "f"]);
    const batch2 = makeBatch(["g", "h", "i", "j", "k", "l"]);
    let state = createMatchState([batch1, batch2]);

    for (const id of ["a", "b", "c", "d", "e", "f"]) {
      state = selectCard(state, "front", id);
      state = selectCard(state, "back", id);
    }
    expect(state.currentBatchIndex).toBe(1);
    expect(phaseOf(state)).toBe("playing");

    for (const id of ["g", "h", "i", "j", "k", "l"]) {
      state = selectCard(state, "front", id);
      state = selectCard(state, "back", id);
    }
    // Matching the final pair of the last batch completes the session.
    expect(phaseOf(state)).toBe("completed");
  });

  it("selecting a front then a different front reselects", () => {
    const batch = makeBatch(["a", "b", "c", "d", "e", "f"]);
    const state = createMatchState([batch]);
    const first = selectCard(state, "front", "a");
    expect(first.selectedFrontId).toBe("a");
    const second = selectCard(first, "front", "b");
    expect(second.selectedFrontId).toBe("b");
    expect(second.selectedBackId).toBeNull();
  });

  it("tapping a back without a selected front selects the back instead", () => {
    const batch = makeBatch(["a", "b", "c", "d", "e", "f"]);
    const state = createMatchState([batch]);
    const withBack = selectCard(state, "back", "b");
    expect(withBack.selectedBackId).toBe("b");
    expect(withBack.selectedFrontId).toBeNull();
  });

  it("replay builds a fresh session from new batches", () => {
    const batch = makeBatch(["a", "b", "c", "d", "e", "f"]);
    const state = createMatchState([batch]);
    const matched = selectCard(selectCard(state, "front", "a"), "back", "a");
    expect(matched.matchedFrontIds.size).toBe(1);
    // Simulate replay by constructing a new state from fresh batches.
    const fresh = createMatchState([makeBatch(["a", "b", "c", "d", "e", "f"])]);
    expect(fresh.matchedFrontIds.size).toBe(0);
    expect(fresh.currentBatchIndex).toBe(0);
    expect(fresh.selectedFrontId).toBeNull();
  });
});
