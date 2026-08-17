import { describe, expect, it } from "vitest";

import type { MatchBatch, MatchCard } from "@/features/match/types/match-types";
import {
  createMatchState,
  incorrectAttemptCountOf,
  phaseOf,
  selectCard,
} from "@/features/match/utils/match-state";

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

  it("resolves a correct pair when the Back is selected before the Front", () => {
    const batch = makeBatch(["a", "b", "c", "d", "e", "f"]);
    const state = createMatchState([batch]);

    const afterSelectBack = selectCard(state, "back", "a");
    expect(afterSelectBack.selectedBackId).toBe("a");
    expect(afterSelectBack.selectedFrontId).toBeNull();

    const afterMatch = selectCard(afterSelectBack, "front", "a");
    expect(afterMatch.matchedFrontIds.has("a")).toBe(true);
    expect(afterMatch.matchedBackIds.has("a")).toBe(true);
    expect(afterMatch.lastResult).toBe("correct");
    expect(afterMatch.selectedFrontId).toBeNull();
    expect(afterMatch.selectedBackId).toBeNull();
  });

  it("resolves a correct pair when the Front is selected before the Back", () => {
    const batch = makeBatch(["a", "b", "c", "d", "e", "f"]);
    const state = createMatchState([batch]);

    const afterSelectFront = selectCard(state, "front", "a");
    expect(afterSelectFront.selectedFrontId).toBe("a");

    const afterMatch = selectCard(afterSelectFront, "back", "a");
    expect(afterMatch.matchedFrontIds.has("a")).toBe(true);
    expect(afterMatch.matchedBackIds.has("a")).toBe(true);
    expect(afterMatch.lastResult).toBe("correct");
  });

  it("reports an incorrect pair regardless of click order", () => {
    const batch = makeBatch(["a", "b", "c", "d", "e", "f"]);
    const state = createMatchState([batch]);

    const frontFirst = selectCard(selectCard(state, "front", "a"), "back", "b");
    expect(frontFirst.lastResult).toBe("incorrect");
    expect(frontFirst.matchedFrontIds.size).toBe(0);
    expect(frontFirst.incorrectAttemptCount).toBe(1);

    const backFirst = selectCard(selectCard(state, "back", "b"), "front", "a");
    expect(backFirst.lastResult).toBe("incorrect");
    expect(backFirst.matchedFrontIds.size).toBe(0);
    expect(backFirst.selectedFrontId).toBeNull();
    expect(backFirst.selectedBackId).toBeNull();
    expect(backFirst.incorrectAttemptCount).toBe(1);
  });

  it("counts each incorrect attempt across the whole session without resetting per batch", () => {
    const batch1 = makeBatch(["a", "b", "c", "d", "e", "f"]);
    const batch2 = makeBatch(["g", "h", "i", "j", "k", "l"]);
    let state = createMatchState([batch1, batch2]);
    expect(incorrectAttemptCountOf(state)).toBe(0);

    state = selectCard(selectCard(state, "front", "a"), "back", "b");
    state = selectCard(selectCard(state, "front", "c"), "back", "d");
    expect(incorrectAttemptCountOf(state)).toBe(2);

    // Completing the first batch advances but keeps the incorrect count.
    for (const id of ["a", "b", "c", "d", "e", "f"]) {
      state = selectCard(state, "front", id);
      state = selectCard(state, "back", id);
    }
    expect(state.currentBatchIndex).toBe(1);
    expect(incorrectAttemptCountOf(state)).toBe(2);

    state = selectCard(selectCard(state, "front", "g"), "back", "g");
    expect(incorrectAttemptCountOf(state)).toBe(2);
  });

  it("records correct and wrong card ids across the whole session", () => {
    const batch1 = makeBatch(["a", "b", "c", "d", "e", "f"]);
    const batch2 = makeBatch(["g", "h", "i", "j", "k", "l"]);
    let state = createMatchState([batch1, batch2]);

    // Wrong attempt first: a/b are recorded as wrong.
    state = selectCard(selectCard(state, "front", "a"), "back", "b");
    expect(state.wrongCardIds).toContain("a");
    expect(state.wrongCardIds).toContain("b");
    expect(state.correctCardIds).toEqual([]);

    // Correct matching of a later pair adds it to correct ids without
    // removing the earlier wrong entries.
    state = selectCard(selectCard(state, "front", "c"), "back", "c");
    expect(state.correctCardIds).toContain("c");
    expect(state.wrongCardIds).toContain("a");

    // A card wrong earlier then correctly matched ends up in both lists (the
    // completion payload lets correct win).
    state = selectCard(selectCard(state, "front", "a"), "back", "a");
    expect(state.correctCardIds).toContain("a");
    expect(state.wrongCardIds).toContain("a");

    // No duplicate entries when a correct pair is selected once.
    state = selectCard(selectCard(state, "front", "d"), "back", "d");
    state = selectCard(selectCard(state, "front", "d"), "back", "d");
    expect(state.correctCardIds.filter((id) => id === "d")).toHaveLength(1);

    // b was wrong earlier, then correctly matched — it lands in both lists
    // (the completion payload lets correct win per card).
    state = selectCard(selectCard(state, "front", "b"), "back", "b");
    expect(state.correctCardIds).toContain("b");
    expect(state.wrongCardIds).toContain("b");

    // Completing batch 1 keeps per-card ids (they must persist to the end).
    for (const id of ["e", "f"]) {
      state = selectCard(state, "front", id);
      state = selectCard(state, "back", id);
    }
    expect(state.currentBatchIndex).toBe(1);
    expect(state.correctCardIds).toContain("a");
    expect(state.correctCardIds).toContain("c");

    // Batch 2 wrong pairing still appends to the same wrong list.
    state = selectCard(selectCard(state, "front", "g"), "back", "h");
    expect(state.wrongCardIds).toContain("g");
    expect(state.wrongCardIds).toContain("h");
  });

  it("does not count correct pairs as incorrect attempts", () => {
    const batch = makeBatch(["a", "b", "c", "d", "e", "f"]);
    let state = createMatchState([batch]);
    for (const id of ["a", "b", "c", "d", "e", "f"]) {
      state = selectCard(state, "front", id);
      state = selectCard(state, "back", id);
    }
    expect(incorrectAttemptCountOf(state)).toBe(0);
    expect(state.completedPairCount).toBe(6);
  });

  it("toggles off when re-selecting a Front already selected with no Back pending", () => {
    const batch = makeBatch(["a", "b", "c", "d", "e", "f"]);
    const state = createMatchState([batch]);

    const first = selectCard(state, "front", "a");
    expect(first.selectedFrontId).toBe("a");
    const second = selectCard(first, "front", "a");
    expect(second.selectedFrontId).toBeNull();
  });

  it("toggles off when re-selecting a Back already selected with no Front pending", () => {
    const batch = makeBatch(["a", "b", "c", "d", "e", "f"]);
    const state = createMatchState([batch]);

    const first = selectCard(state, "back", "b");
    expect(first.selectedBackId).toBe("b");
    const second = selectCard(first, "back", "b");
    expect(second.selectedBackId).toBeNull();
  });

  it("ignores a matched Back tapped after a Back-first selection", () => {
    const batch = makeBatch(["a", "b", "c", "d", "e", "f"]);
    const state = createMatchState([batch]);
    const matched = selectCard(selectCard(state, "back", "a"), "front", "a");
    const again = selectCard(matched, "back", "a");
    expect(again.selectedBackId).toBeNull();
    expect(again.matchedBackIds.has("a")).toBe(true);
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
    expect(current.completedPairCount).toBe(6);
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
    expect(state.completedPairCount).toBe(12);
  });

  it("does not advance twice when a stale tap follows the sixth pair", () => {
    const batch1 = makeBatch(["a", "b", "c", "d", "e", "f"]);
    const batch2 = makeBatch(["g", "h", "i", "j", "k", "l"]);
    let state = createMatchState([batch1, batch2]);
    for (const id of ["a", "b", "c", "d", "e", "f"]) {
      state = selectCard(state, "front", id);
      state = selectCard(state, "back", id);
    }

    const afterStaleTap = selectCard(state, "back", "f");
    expect(afterStaleTap.currentBatchIndex).toBe(1);
    expect(afterStaleTap.completedPairCount).toBe(6);
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
