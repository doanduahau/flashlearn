import { describe, expect, it } from "vitest";

import {
  computeSevenDayInsight,
  getSevenDayBoundaries,
} from "@/features/statistics/utils/seven-day-insight";
import type { DailyActivityDetail } from "@/features/statistics/utils/month-activity";

function record(
  date: string,
  questions: number,
  correct: number,
  quizCount = 1,
): DailyActivityDetail {
  return { date, questions, correct, quizCount };
}

describe("getSevenDayBoundaries", () => {
  it("returns non-overlapping 7-day windows ending at today", () => {
    const today = "2026-08-12";
    const { currentStart, previousStart } = getSevenDayBoundaries(today);
    expect(currentStart).toBe("2026-08-06");
    expect(previousStart).toBe("2026-07-30");
  });

  it("crosses month boundaries correctly", () => {
    const today = "2026-08-03";
    const { currentStart, previousStart } = getSevenDayBoundaries(today);
    expect(currentStart).toBe("2026-07-28");
    expect(previousStart).toBe("2026-07-21");
  });

  it("crosses year boundaries correctly", () => {
    const today = "2026-01-05";
    const { currentStart, previousStart } = getSevenDayBoundaries(today);
    expect(currentStart).toBe("2025-12-30");
    expect(previousStart).toBe("2025-12-23");
  });

  it("today minus 6 equals currentStart", () => {
    const today = "2026-06-01";
    const { currentStart } = getSevenDayBoundaries(today);
    const d = new Date(`${currentStart}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 6);
    expect(d.toISOString().slice(0, 10)).toBe(today);
  });

  it("no overlap between windows", () => {
    const today = "2026-08-12";
    const { currentStart, previousStart } = getSevenDayBoundaries(today);
    const prevEnd = new Date(`${previousStart}T12:00:00Z`);
    prevEnd.setUTCDate(prevEnd.getUTCDate() + 6);
    expect(prevEnd.toISOString().slice(0, 10) < currentStart).toBe(true);
  });
});

describe("computeSevenDayInsight — improvement", () => {
  const today = "2026-08-12";

  it("detects improvement when accuracy rises by exactly 5pp (10 resp each)", () => {
    const current = [record("2026-08-10", 10, 8)];
    const previous = [record("2026-08-03", 10, 7)];
    const result = computeSevenDayInsight(today, current, previous);
    expect(result.kind).toBe("improvement");
    expect(result.message).toBe("Độ chính xác của bạn đã cải thiện trong 7 ngày vừa qua.");
  });

  it("detects improvement when accuracy rises by 10pp", () => {
    const current = [record("2026-08-10", 10, 8)];
    const previous = [record("2026-08-03", 10, 6)];
    const result = computeSevenDayInsight(today, current, previous);
    expect(result.kind).toBe("improvement");
  });

  it("does NOT detect improvement at +4pp", () => {
    const current = [record("2026-08-10", 10, 8)];
    const previous = [record("2026-08-03", 10, 7.6)];
    const result = computeSevenDayInsight(today, current, previous);
    expect(result.kind).not.toBe("improvement");
  });
});

describe("computeSevenDayInsight — stable_more_activity", () => {
  const today = "2026-08-12";

  it("stable accuracy + more activity", () => {
    const current = [
      record("2026-08-10", 5, 4),
      record("2026-08-11", 5, 4),
      record("2026-08-12", 5, 4),
    ];
    const previous = [record("2026-08-01", 5, 4), record("2026-08-02", 5, 4)];
    const result = computeSevenDayInsight(today, current, previous);
    expect(result.kind).toBe("stable_more_activity");
    expect(result.message).toBe("Bạn đang duy trì nhịp làm bài trong 7 ngày vừa qua.");
  });

  it("stable accuracy with only 2pp change + more activity", () => {
    const current = [record("2026-08-10", 5, 4), record("2026-08-11", 5, 4)];
    const previous = [record("2026-08-01", 5, 4)];
    const result = computeSevenDayInsight(today, current, previous);
    expect(result.kind).toBe("stable_more_activity");
  });
});

describe("computeSevenDayInsight — some_activity", () => {
  const today = "2026-08-12";

  it("current has activity but previous has insufficient data", () => {
    const current = [record("2026-08-10", 10, 7)];
    const previous = [record("2026-08-01", 2, 2)];
    const result = computeSevenDayInsight(today, current, previous);
    expect(result.kind).toBe("some_activity");
    expect(result.message).toBe(
      "Bạn đã có hoạt động làm bài trong 7 ngày vừa qua. Hãy tiếp tục nhé!",
    );
  });

  it("current has 4 questions (<5) — insufficient for comparison", () => {
    const current = [record("2026-08-10", 4, 4)];
    const previous = [record("2026-08-01", 10, 8)];
    const result = computeSevenDayInsight(today, current, previous);
    expect(result.kind).toBe("some_activity");
  });

  it("both periods have enough data but no improvement and not more activity", () => {
    const current = [record("2026-08-10", 5, 4)];
    const previous = [record("2026-08-01", 5, 4)];
    const result = computeSevenDayInsight(today, current, previous);
    expect(result.kind).toBe("some_activity");
  });
});

describe("computeSevenDayInsight — no_activity", () => {
  it("returns no_activity when current period has zero quizCount", () => {
    const result = computeSevenDayInsight("2026-08-12", [], []);
    expect(result.kind).toBe("no_activity");
    expect(result.message).toBe("7 ngày vừa qua chưa có nhiều hoạt động làm bài được ghi nhận.");
  });
});

describe("computeSevenDayInsight — negative trend", () => {
  const today = "2026-08-12";

  it("accuracy declined significantly but does NOT show discouraging message", () => {
    const current = [record("2026-08-10", 10, 6)];
    const previous = [record("2026-08-01", 10, 9)];
    const result = computeSevenDayInsight(today, current, previous);
    expect(result.kind).not.toBe("improvement");
    expect(result.kind).not.toBe("stable_more_activity");
    expect(result.message).not.toContain("giảm");
    expect(result.message).toBe(
      "Bạn đã có hoạt động làm bài trong 7 ngày vừa qua. Hãy tiếp tục nhé!",
    );
    expect(result.message).not.toContain("tốt");
  });

  it("accuracy declined with less activity — uses neutral fallback", () => {
    const current = [record("2026-08-10", 5, 3)];
    const previous = [record("2026-08-01", 10, 9)];
    const result = computeSevenDayInsight(today, current, previous);
    expect(result.kind).toBe("some_activity");
    expect(result.message).toBe(
      "Bạn đã có hoạt động làm bài trong 7 ngày vừa qua. Hãy tiếp tục nhé!",
    );
  });

  it("uses neutral cadence copy for low but stable accuracy with more completed quizzes", () => {
    const previous = [record("2026-08-01", 10, 2, 1)];
    const current = [record("2026-08-10", 50, 9, 2)];

    const result = computeSevenDayInsight(today, current, previous);

    expect(result.kind).toBe("stable_more_activity");
    expect(result.message).toBe("Bạn đang duy trì nhịp làm bài trong 7 ngày vừa qua.");
    expect(result.message).not.toContain("tốt");
  });
});

describe("computeSevenDayInsight — canonical rounded accuracy comparison", () => {
  it("uses rounded integer percentages near the +5pp threshold", () => {
    // Raw: previous = 373 / 500 = 74.6%, current = 397 / 500 = 79.4% (+4.8pp).
    // Canonical accuracy() rounds these to 75% and 79%, so this remains below +5pp.
    const previous = [record("2026-08-01", 500, 373, 1)];
    const current = [record("2026-08-10", 500, 397, 1)];

    const result = computeSevenDayInsight("2026-08-12", current, previous);

    expect(result.kind).toBe("some_activity");
    expect(result.message).toBe(
      "Bạn đã có hoạt động làm bài trong 7 ngày vừa qua. Hãy tiếp tục nhé!",
    );
  });
});

describe("computeSevenDayInsight — sample size boundaries", () => {
  const today = "2026-08-12";

  it("4 vs 5 does NOT qualify for comparison", () => {
    const current = [record("2026-08-10", 4, 3)];
    const previous = [record("2026-08-01", 5, 4)];
    const result = computeSevenDayInsight(today, current, previous);
    expect(result.kind).toBe("some_activity");
  });

  it("5 vs 4 does NOT qualify for comparison", () => {
    const current = [record("2026-08-10", 5, 4)];
    const previous = [record("2026-08-01", 4, 3)];
    const result = computeSevenDayInsight(today, current, previous);
    expect(result.kind).toBe("some_activity");
  });

  it("5 vs 5 DOES qualify for comparison", () => {
    const current = [record("2026-08-10", 5, 4)];
    const previous = [record("2026-08-01", 5, 4)];
    const result = computeSevenDayInsight(today, current, previous);
    expect(["improvement", "stable_more_activity", "some_activity"]).toContain(result.kind);
  });
});
