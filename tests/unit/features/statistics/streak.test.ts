import { describe, expect, it } from "vitest";

import { computeStreakRun, computeStreaks } from "@/features/statistics/utils/streak";

const NO_RECOVERY = { recoverable: false, needsRecoveryQuizzes: 0 };

describe("computeStreaks", () => {
  it("counts the current streak through today when today is active", () => {
    const dates = ["2026-08-04", "2026-08-05", "2026-08-06"];
    expect(computeStreaks(dates, "2026-08-06")).toEqual({
      current: 3,
      longest: 3,
      completedToday: true,
      ...NO_RECOVERY,
    });
  });

  it("counts the current streak through yesterday when today is missing", () => {
    const dates = ["2026-08-04", "2026-08-05", "2026-08-06"];
    expect(computeStreaks(dates, "2026-08-07")).toEqual({
      current: 3,
      longest: 3,
      completedToday: false,
      ...NO_RECOVERY,
    });
  });

  it("resets the current streak when yesterday is missing", () => {
    const dates = ["2026-08-05", "2026-08-06"];
    expect(computeStreaks(dates, "2026-08-06")).toEqual({
      current: 2,
      longest: 2,
      completedToday: true,
      ...NO_RECOVERY,
    });

    const separated = ["2026-08-04", "2026-08-06"];
    expect(computeStreaks(separated, "2026-08-06", 0)).toEqual({
      current: 1,
      longest: 1,
      completedToday: true,
      recoverable: true,
      needsRecoveryQuizzes: 3,
    });
  });

  it("tracks the longest streak separately from the current one", () => {
    const dates = ["2026-07-28", "2026-07-29", "2026-07-30", "2026-08-05", "2026-08-06"];
    expect(computeStreaks(dates, "2026-08-06")).toEqual({
      current: 2,
      longest: 3,
      completedToday: true,
      ...NO_RECOVERY,
    });
  });

  it("handles unordered, duplicate, and empty inputs", () => {
    const unordered = ["2026-08-06", "2026-08-04", "2026-08-06", "2026-08-05"];
    expect(computeStreaks(unordered, "2026-08-06")).toEqual({
      current: 3,
      longest: 3,
      completedToday: true,
      ...NO_RECOVERY,
    });
    expect(computeStreaks([], "2026-08-06")).toEqual({
      current: 0,
      longest: 0,
      completedToday: false,
      ...NO_RECOVERY,
    });
  });

  it("marks a one-day gap as recoverable when nothing is done today", () => {
    // Active on 08-04 and 08-05, missed 08-06, today is 08-07.
    const dates = ["2026-08-04", "2026-08-05"];
    expect(computeStreaks(dates, "2026-08-07", 0)).toEqual({
      current: 2,
      longest: 2,
      completedToday: false,
      recoverable: true,
      needsRecoveryQuizzes: 3,
    });
  });

  it("keeps the old run visible while 1-2 quizzes are done today", () => {
    // A quiz completion today creates today's record, so today is active.
    const dates = ["2026-08-04", "2026-08-05", "2026-08-07"];
    expect(computeStreaks(dates, "2026-08-07", 1)).toEqual({
      current: 2,
      longest: 2,
      completedToday: true,
      recoverable: true,
      needsRecoveryQuizzes: 2,
    });
    expect(computeStreaks(dates, "2026-08-07", 2)).toEqual({
      current: 2,
      longest: 2,
      completedToday: true,
      recoverable: true,
      needsRecoveryQuizzes: 1,
    });
  });

  it("re-joins the old run when 3 quizzes are done today after a one-day gap", () => {
    const dates = ["2026-08-04", "2026-08-05", "2026-08-07"];
    expect(computeStreaks(dates, "2026-08-07", 3)).toEqual({
      current: 3,
      longest: 3,
      completedToday: true,
      ...NO_RECOVERY,
    });
  });

  it("loses the streak entirely after a gap of two or more days", () => {
    const dates = ["2026-08-04", "2026-08-05"];
    expect(computeStreaks(dates, "2026-08-08", 3)).toEqual({
      current: 0,
      longest: 2,
      completedToday: false,
      ...NO_RECOVERY,
    });
  });

  it("restarts from today after a long gap ends with activity today", () => {
    const dates = ["2026-08-04", "2026-08-05", "2026-08-08"];
    expect(computeStreaks(dates, "2026-08-08", 1)).toEqual({
      current: 1,
      longest: 2,
      completedToday: true,
      ...NO_RECOVERY,
    });
  });

  it("returns every consecutive current-run date newest to oldest", () => {
    const dates = ["2026-07-28", "2026-08-04", "2026-08-05", "2026-08-06"];
    expect(computeStreakRun(dates, "2026-08-06")).toEqual([
      "2026-08-06",
      "2026-08-05",
      "2026-08-04",
    ]);
  });

  it("starts the run at yesterday when today is not active", () => {
    const dates = ["2026-08-04", "2026-08-05", "2026-08-06"];
    expect(computeStreakRun(dates, "2026-08-07")).toEqual([
      "2026-08-06",
      "2026-08-05",
      "2026-08-04",
    ]);
  });

  it("returns an empty run with no activity or a broken streak", () => {
    expect(computeStreakRun([], "2026-08-06")).toEqual([]);
    expect(computeStreakRun(["2026-08-04", "2026-08-06"], "2026-08-06")).toEqual(["2026-08-06"]);
  });
});
