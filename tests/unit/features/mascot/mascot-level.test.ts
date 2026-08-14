import { describe, expect, it } from "vitest";

import { levelFromStreak } from "@/features/mascot/utils/mascot-level";

describe("levelFromStreak", () => {
  it("maps streaks below 30 to level 1", () => {
    expect(levelFromStreak(0)).toBe(1);
    expect(levelFromStreak(1)).toBe(1);
    expect(levelFromStreak(29)).toBe(1);
  });

  it("maps 30–59 to level 2", () => {
    expect(levelFromStreak(30)).toBe(2);
    expect(levelFromStreak(59)).toBe(2);
  });

  it("maps 60–119 to level 3", () => {
    expect(levelFromStreak(60)).toBe(3);
    expect(levelFromStreak(119)).toBe(3);
  });

  it("maps 120–239 to level 4", () => {
    expect(levelFromStreak(120)).toBe(4);
    expect(levelFromStreak(239)).toBe(4);
  });

  it("maps 240 and above to level 5", () => {
    expect(levelFromStreak(240)).toBe(5);
    expect(levelFromStreak(1000)).toBe(5);
  });

  it("treats negative or non-finite input as level 1", () => {
    expect(levelFromStreak(-1)).toBe(1);
    expect(levelFromStreak(Number.NaN)).toBe(1);
    expect(levelFromStreak(Number.POSITIVE_INFINITY)).toBe(1);
  });
});
