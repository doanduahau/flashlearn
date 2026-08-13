import { describe, expect, it } from "vitest";

import type { MemoryBatch } from "@/features/memory/types/memory-types";
import {
  createMemoryState,
  isFinalPendingPair,
  isTileFlipped,
  isTileMatched,
  previewTile,
  resolveCelebration,
  resolveCorrectPair,
  resolveMismatch,
  tapTile,
} from "@/features/memory/utils/memory-state";

function batchFor(cardIds: string[]): MemoryBatch {
  const tiles = cardIds.flatMap((cardId) => [
    { key: `${cardId}:front`, cardId, side: "front" as const, content: `${cardId}-front` },
    { key: `${cardId}:back`, cardId, side: "back" as const, content: `${cardId}-back` },
  ]);
  return { tiles };
}

const BATCH = batchFor(["a", "b", "c", "d", "e", "f"]);

describe("memory state machine", () => {
  it("first flip reveals one tile and previews its content", () => {
    const state = createMemoryState([BATCH]);
    const next = tapTile(state, "a:front");
    expect(isTileFlipped(next, "a:front")).toBe(true);
    expect(previewTile(next)?.content).toBe("a-front");
  });

  it("second flip previews the second tile content", () => {
    const state = createMemoryState([BATCH]);
    const first = tapTile(state, "a:front");
    const second = tapTile(first, "b:back");
    expect(previewTile(second)?.content).toBe("b-back");
  });

  it("tapping the same first tile twice does not resolve a pair", () => {
    const state = createMemoryState([BATCH]);
    const first = tapTile(state, "a:front");
    const again = tapTile(first, "a:front");
    expect(again.phase).toBe("playing");
    expect(again.firstKey).toBe("a:front");
    expect(again.matchedKeys.size).toBe(0);
  });

  it("a correct pair enters the review window without marking matched yet", () => {
    const state = createMemoryState([BATCH]);
    const first = tapTile(state, "a:front");
    const pending = tapTile(first, "a:back");
    expect(pending.phase).toBe("correct-pending");
    expect(isTileFlipped(pending, "a:front")).toBe(true);
    expect(isTileFlipped(pending, "a:back")).toBe(true);
    expect(isTileMatched(pending, "a:front")).toBe(false);
    expect(isTileMatched(pending, "a:back")).toBe(false);
    expect(pending.completedCount).toBe(0);
    expect(previewTile(pending)?.content).toBe("a-back");
  });

  it("resolveCorrectPair marks both tiles matched after the review window", () => {
    const state = createMemoryState([BATCH]);
    const pending = tapTile(tapTile(state, "a:front"), "a:back");
    const resolved = resolveCorrectPair(pending);
    expect(isTileMatched(resolved, "a:front")).toBe(true);
    expect(isTileMatched(resolved, "a:back")).toBe(true);
    expect(resolved.completedCount).toBe(1);
  });

  it("a correct pair produces a celebration signal after the review window", () => {
    const state = createMemoryState([BATCH]);
    const pending = tapTile(tapTile(state, "a:front"), "a:back");
    expect(pending.phase).toBe("correct-pending");
    const resolved = resolveCorrectPair(pending);
    expect(resolved.phase).toBe("celebration");
  });

  it("an incorrect pair keeps both flipped during resolution and does not mark matched", () => {
    const state = createMemoryState([BATCH]);
    const first = tapTile(state, "a:front");
    const second = tapTile(first, "b:back");
    expect(second.phase).toBe("mismatch");
    expect(isTileMatched(second, "a:front")).toBe(false);
    expect(isTileMatched(second, "b:back")).toBe(false);
    expect(isTileFlipped(second, "a:front")).toBe(true);
    expect(isTileFlipped(second, "b:back")).toBe(true);
  });

  it("mismatch has no red tile state (only phase/preview signals)", () => {
    const state = createMemoryState([BATCH]);
    const first = tapTile(state, "a:front");
    const second = tapTile(first, "b:back");
    expect(second.phase).toBe("mismatch");
    // No "red" or "wrong" state exists on tiles; resolution is phase-level.
    expect(second.matchedKeys.size).toBe(0);
  });

  it("after mismatch resolution both tiles face down and preview is neutral", () => {
    const state = createMemoryState([BATCH]);
    const first = tapTile(state, "a:front");
    const mismatch = tapTile(first, "b:back");
    const resolved = resolveMismatch(mismatch);
    expect(resolved.phase).toBe("playing");
    expect(isTileFlipped(resolved, "a:front")).toBe(false);
    expect(isTileFlipped(resolved, "b:back")).toBe(false);
    expect(previewTile(resolved)).toBeNull();
  });

  it("a correct pair produces a celebration signal after the review window", () => {
    const state = createMemoryState([BATCH]);
    const pending = tapTile(tapTile(state, "a:front"), "a:back");
    expect(pending.phase).toBe("correct-pending");
    const resolved = resolveCorrectPair(pending);
    expect(resolved.phase).toBe("celebration");
  });

  it("a matched tile cannot be selected again", () => {
    const state = createMemoryState([BATCH]);
    const pending = tapTile(tapTile(state, "a:front"), "a:back");
    const resolved = resolveCorrectPair(pending);
    const celebrationResolved = resolveCelebration(resolved);
    const reselect = tapTile(celebrationResolved, "a:front");
    expect(reselect.matchedKeys.has("a:front")).toBe(true);
    expect(reselect.firstKey).not.toBe("a:front");
  });

  it("a third tap is ignored during mismatch resolution", () => {
    const state = createMemoryState([BATCH]);
    const first = tapTile(state, "a:front");
    const mismatch = tapTile(first, "b:back");
    const third = tapTile(mismatch, "c:front");
    // phase remains mismatch, no new selection recorded
    expect(third.phase).toBe("mismatch");
    expect(third.firstKey).toBe("a:front");
    expect(third.secondKey).toBe("b:back");
  });

  it("a third tap is ignored during the correct-pair review window", () => {
    const state = createMemoryState([BATCH]);
    const pending = tapTile(tapTile(state, "a:front"), "a:back");
    const third = tapTile(pending, "c:front");
    expect(third.phase).toBe("correct-pending");
    expect(third.firstKey).toBe("a:front");
    expect(third.secondKey).toBe("a:back");
    expect(isTileFlipped(third, "c:front")).toBe(false);
    expect(isTileMatched(third, "a:front")).toBe(false);
  });

  it("resolving the sixth pair advances the batch once", () => {
    const batch1 = BATCH;
    const batch2 = batchFor(["g", "h", "i", "j", "k", "l"]);
    const state = createMemoryState([batch1, batch2]);

    let current = state;
    for (const cardId of ["a", "b", "c", "d", "e", "f"]) {
      current = tapTile(current, `${cardId}:front`);
      current = tapTile(current, `${cardId}:back`);
      if (current.phase === "correct-pending") current = resolveCorrectPair(current);
      if (current.phase === "celebration") current = resolveCelebration(current);
    }
    expect(current.currentBatchIndex).toBe(1);
    expect(current.phase).toBe("playing");
  });

  it("final pair completes the session exactly once", () => {
    const batch1 = BATCH;
    const batch2 = batchFor(["g", "h", "i", "j", "k", "l"]);
    const state = createMemoryState([batch1, batch2]);

    let current = state;
    for (const cardId of ["a", "b", "c", "d", "e", "f"]) {
      current = tapTile(current, `${cardId}:front`);
      current = tapTile(current, `${cardId}:back`);
      if (current.phase === "correct-pending") current = resolveCorrectPair(current);
      if (current.phase === "celebration") current = resolveCelebration(current);
    }
    expect(current.currentBatchIndex).toBe(1);

    for (const cardId of ["g", "h", "i", "j", "k", "l"]) {
      current = tapTile(current, `${cardId}:front`);
      current = tapTile(current, `${cardId}:back`);
      if (current.phase === "correct-pending") current = resolveCorrectPair(current);
      if (current.phase === "celebration") current = resolveCelebration(current);
    }
    expect(current.phase).toBe("completed");
    expect(current.completedCount).toBe(12);
  });

  it("isFinalPendingPair is only true for the pending pair that finishes the final batch", () => {
    const batch1 = BATCH;
    const batch2 = batchFor(["g", "h", "i", "j", "k", "l"]);
    const state = createMemoryState([batch1, batch2]);

    let current = state;
    for (const cardId of ["a", "b", "c", "d", "e"]) {
      current = tapTile(current, `${cardId}:front`);
      current = tapTile(current, `${cardId}:back`);
      if (current.phase === "correct-pending") current = resolveCorrectPair(current);
      if (current.phase === "celebration") current = resolveCelebration(current);
    }

    // Pair f completes batch 1, but batch 2 still exists, so it is not final.
    current = tapTile(current, "f:front");
    current = tapTile(current, "f:back");
    expect(isFinalPendingPair(current)).toBe(false);
    if (current.phase === "correct-pending") current = resolveCorrectPair(current);
    if (current.phase === "celebration") current = resolveCelebration(current);

    for (const cardId of ["g", "h", "i", "j", "k"]) {
      current = tapTile(current, `${cardId}:front`);
      current = tapTile(current, `${cardId}:back`);
      if (current.phase === "correct-pending") current = resolveCorrectPair(current);
      if (current.phase === "celebration") current = resolveCelebration(current);
    }

    // Pair l completes batch 2, the last batch: this is the final pair.
    current = tapTile(current, "l:front");
    current = tapTile(current, "l:back");
    expect(current.phase).toBe("correct-pending");
    expect(isFinalPendingPair(current)).toBe(true);
  });

  it("correctness is by card identity, not text equality", () => {
    const batch = batchFor(["a", "b"]);
    const state = createMemoryState([batch]);
    // Same card (a) but opposite side is a match even though contents differ.
    const first = tapTile(state, "a:front");
    const pending = tapTile(first, "a:back");
    const resolved = resolveCorrectPair(pending);
    expect(isTileMatched(resolved, "a:front")).toBe(true);
    expect(isTileMatched(resolved, "a:back")).toBe(true);
  });
});
