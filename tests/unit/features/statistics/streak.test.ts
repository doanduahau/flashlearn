import { describe, expect, it } from "vitest";

import { computeStreaks } from "@/features/statistics/utils/streak";

describe("computeStreaks", () => {
  it("counts the current streak through today when today is active", () => {
    const dates = ["2026-08-04", "2026-08-05", "2026-08-06"];
    expect(computeStreaks(dates, "2026-08-06")).toEqual({
      current: 3,
      longest: 3,
      completedToday: true,
    });
  });

  it("counts the current streak through yesterday when today is missing", () => {
    const dates = ["2026-08-04", "2026-08-05", "2026-08-06"];
    expect(computeStreaks(dates, "2026-08-07")).toEqual({
      current: 3,
      longest: 3,
      completedToday: false,
    });
  });

  it("resets the current streak when yesterday is missing", () => {
    const dates = ["2026-08-05", "2026-08-06"];
    expect(computeStreaks(dates, "2026-08-06")).toEqual({
      current: 2,
      longest: 2,
      completedToday: true,
    });

    const separated = ["2026-08-04", "2026-08-06"];
    expect(computeStreaks(separated, "2026-08-06")).toEqual({
      current: 1,
      longest: 1,
      completedToday: true,
    });
  });

  it("tracks the longest streak separately from the current one", () => {
    const dates = ["2026-07-28", "2026-07-29", "2026-07-30", "2026-08-05", "2026-08-06"];
    expect(computeStreaks(dates, "2026-08-06")).toEqual({
      current: 2,
      longest: 3,
      completedToday: true,
    });
  });

  it("handles unordered, duplicate, and empty inputs", () => {
    const unordered = ["2026-08-06", "2026-08-04", "2026-08-06", "2026-08-05"];
    expect(computeStreaks(unordered, "2026-08-06")).toEqual({
      current: 3,
      longest: 3,
      completedToday: true,
    });
    expect(computeStreaks([], "2026-08-06")).toEqual({
      current: 0,
      longest: 0,
      completedToday: false,
    });
  });
});
