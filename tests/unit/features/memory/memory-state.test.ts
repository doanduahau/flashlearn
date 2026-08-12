import { describe, expect, it } from "vitest";

import type { MemoryBatch } from "@/features/memory/types/memory-types";
import {
  createMemoryState,
  isTileFlipped,
  isTileMatched,
  previewTile,
  resolveCelebration,
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

  it("a correct pair marks both tiles matched and disabled", () => {
    const state = createMemoryState([BATCH]);
    const first = tapTile(state, "a:front");
    const second = tapTile(first, "a:back");
    expect(isTileMatched(second, "a:front")).toBe(true);
    expect(isTileMatched(second, "a:back")).toBe(true);
    expect(second.completedCount).toBe(1);
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

  it("a correct pair produces a celebration signal (celebration phase)", () => {
    const state = createMemoryState([BATCH]);
    const first = tapTile(state, "a:front");
    const second = tapTile(first, "a:back");
    expect(second.phase).toBe("celebration");
  });

  it("a matched tile cannot be selected again", () => {
    const state = createMemoryState([BATCH]);
    const first = tapTile(state, "a:front");
    const matched = tapTile(first, "a:back");
    const celebrationResolved = resolveCelebration(matched);
    const reselect = tapTile(celebrationResolved, "a:front");
    expect(reselect.matchedKeys.has("a:front")).toBe(true);
    expect(reselect.firstKey).not.toBe("a:front");
  });

  it("a third tap is ignored during resolution", () => {
    const state = createMemoryState([BATCH]);
    const first = tapTile(state, "a:front");
    const mismatch = tapTile(first, "b:back");
    const third = tapTile(mismatch, "c:front");
    // phase remains mismatch, no new selection recorded
    expect(third.phase).toBe("mismatch");
    expect(third.firstKey).toBe("a:front");
    expect(third.secondKey).toBe("b:back");
  });

  it("resolving the sixth pair advances the batch once", () => {
    const batch1 = BATCH;
    const batch2 = batchFor(["g", "h", "i", "j", "k", "l"]);
    const state = createMemoryState([batch1, batch2]);

    let current = state;
    for (const cardId of ["a", "b", "c", "d", "e", "f"]) {
      current = tapTile(current, `${cardId}:front`);
      current = tapTile(current, `${cardId}:back`);
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
      if (current.phase === "celebration") current = resolveCelebration(current);
    }
    expect(current.currentBatchIndex).toBe(1);

    for (const cardId of ["g", "h", "i", "j", "k", "l"]) {
      current = tapTile(current, `${cardId}:front`);
      current = tapTile(current, `${cardId}:back`);
      if (current.phase === "celebration") current = resolveCelebration(current);
    }
    expect(current.phase).toBe("completed");
    expect(current.completedCount).toBe(12);
  });

  it("correctness is by card identity, not text equality", () => {
    const batch = batchFor(["a", "b"]);
    const state = createMemoryState([batch]);
    // Same card (a) but opposite side is a match even though contents differ.
    const first = tapTile(state, "a:front");
    const second = tapTile(first, "a:back");
    expect(isTileMatched(second, "a:front")).toBe(true);
    expect(isTileMatched(second, "a:back")).toBe(true);
  });
});
