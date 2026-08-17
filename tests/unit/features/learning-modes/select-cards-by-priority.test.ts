import { describe, expect, it } from "vitest";

import { selectCardsByPriority } from "@/features/learning-modes/types";

describe("selectCardsByPriority", () => {
  const ids = ["a", "b", "c", "d", "e"];

  it("keeps all latest-wrong cards first", () => {
    expect(selectCardsByPriority(ids, new Set(["c", "a"]), new Map(), 3)).toEqual(["a", "c", "b"]);
  });

  it("orders the remainder by appearance count ascending", () => {
    const appearance = new Map([
      ["a", 2],
      ["b", 1],
      ["c", 0],
      ["d", 5],
    ]);
    expect(selectCardsByPriority(ids, new Set(["b"]), appearance, 5)).toEqual([
      "b",
      "c",
      "e",
      "a",
      "d",
    ]);
  });

  it("treats cards missing from the map as never-appeared", () => {
    const appearance = new Map([
      ["a", 3],
      ["b", 3],
    ]);
    expect(selectCardsByPriority(ids, new Set(), appearance, 4)).toEqual(["c", "d", "e", "a"]);
  });

  it("never includes a card twice", () => {
    const appearance = new Map([
      ["a", 0],
      ["b", 0],
      ["c", 0],
    ]);
    const selected = selectCardsByPriority(ids, new Set(["a", "b"]), appearance, 5);
    expect(selected).toEqual(["a", "b", "c", "d", "e"]);
    expect(new Set(selected).size).toBe(selected.length);
  });

  it("handles zero and counts larger than the pool", () => {
    expect(selectCardsByPriority(ids, new Set(), new Map(), 0)).toEqual([]);
    expect(selectCardsByPriority(ids, new Set(["e"]), new Map(), 99)).toEqual([
      "e",
      "a",
      "b",
      "c",
      "d",
    ]);
  });
});
