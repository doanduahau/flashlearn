import { describe, expect, it } from "vitest";

import { seededShuffle } from "@/features/study/utils/shuffle";

const INPUT = ["a", "b", "c", "d", "e"];

describe("seededShuffle", () => {
  it("produces the same order for the same seed", () => {
    expect(seededShuffle(INPUT, 42)).toEqual(seededShuffle(INPUT, 42));
    expect(seededShuffle(INPUT, 123456)).toEqual(seededShuffle(INPUT, 123456));
  });

  it("keeps the length and element multiset", () => {
    const result = seededShuffle(INPUT, 7);
    expect(result).toHaveLength(INPUT.length);
    expect([...result].sort()).toEqual([...INPUT].sort());
  });

  it("matches a known permutation for a given seed", () => {
    expect(seededShuffle(INPUT, 1)).toEqual(["e", "c", "b", "a", "d"]);
    expect(seededShuffle(INPUT, 42)).toEqual(["a", "e", "c", "b", "d"]);
    expect(seededShuffle(INPUT, 123456)).toEqual(["e", "a", "c", "d", "b"]);
  });

  it("supports the full 32-bit seed range without throwing", () => {
    expect(seededShuffle(INPUT, 0)).toHaveLength(INPUT.length);
    expect(seededShuffle(INPUT, 4294967295)).toHaveLength(INPUT.length);
  });

  it("does not mutate the input array", () => {
    const copy = [...INPUT];
    seededShuffle(INPUT, 42);
    expect(INPUT).toEqual(copy);
  });
});
