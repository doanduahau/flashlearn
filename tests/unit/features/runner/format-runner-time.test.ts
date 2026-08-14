import { describe, expect, it } from "vitest";

import { formatRunnerTime } from "@/features/runner/utils/format-runner-time";

describe("formatRunnerTime", () => {
  it("formats zero as 00:00", () => {
    expect(formatRunnerTime(0)).toBe("00:00");
  });

  it("formats whole minutes", () => {
    expect(formatRunnerTime(60_000)).toBe("01:00");
  });

  it("floors partial seconds", () => {
    expect(formatRunnerTime(61_500)).toBe("01:01");
    expect(formatRunnerTime(61_999)).toBe("01:01");
  });

  it("pads single digits", () => {
    expect(formatRunnerTime(5_000)).toBe("00:05");
    expect(formatRunnerTime(600_000)).toBe("10:00");
  });

  it("allows minutes greater than 59", () => {
    expect(formatRunnerTime(3_600_000)).toBe("60:00");
  });

  it("returns 00:00 for invalid input", () => {
    expect(formatRunnerTime(Number.NaN)).toBe("00:00");
    expect(formatRunnerTime(-1)).toBe("00:00");
    expect(formatRunnerTime(Number.POSITIVE_INFINITY)).toBe("00:00");
  });
});
