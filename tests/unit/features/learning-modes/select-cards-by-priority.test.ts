import { describe, expect, it } from "vitest";

import { selectCardsByPriority } from "@/features/learning-modes/types";

describe("selectCardsByPriority", () => {
  const ids = ["a", "b", "c", "d", "e"];

  it("keeps all latest-wrong cards first", () => {
    expect(selectCardsByPriority(ids, new Set(["c", "a"]), new Set(), 3)).toEqual(["a", "c", "b"]);
  });

  it("uses uncovered cards after latest-wrong cards", () => {
    expect(selectCardsByPriority(ids, new Set(["c"]), new Set(["a", "b", "d"]), 4)).toEqual([
      "c",
      "a",
      "b",
      "d",
    ]);
  });

  it("falls back without duplicates", () => {
    const selected = selectCardsByPriority(ids, new Set(["a", "b"]), new Set(["b", "c"]), 5);
    expect(selected).toEqual(["a", "b", "c", "d", "e"]);
    expect(new Set(selected).size).toBe(selected.length);
  });

  it("handles zero and counts larger than the pool", () => {
    expect(selectCardsByPriority(ids, new Set(), new Set(), 0)).toEqual([]);
    expect(selectCardsByPriority(ids, new Set(["e"]), new Set(), 99)).toEqual([
      "e",
      "a",
      "b",
      "c",
      "d",
    ]);
  });
});
