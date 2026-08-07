import { describe, expect, it } from "vitest";

import {
  addMonths,
  activityLevel,
  calendarDays,
  dateInTimezone,
  monthInTimezone,
  type DailyActivityDetail,
} from "@/features/statistics/utils/month-activity";

function detail(date: string, quizCount: number): DailyActivityDetail {
  return { date, quizCount, questions: quizCount * 5, correct: quizCount * 4 };
}

describe("monthly activity calendar", () => {
  it("fills leading blanks and identifies active, current, and future days", () => {
    const details = new Map([["2026-08-06", detail("2026-08-06", 2)]]);
    const days = calendarDays("2026-08", details, "2026-08-06");

    expect(days.slice(0, 5).every((day) => day.day === null)).toBe(true);
    expect(days.find((day) => day.date === "2026-08-06")).toMatchObject({
      active: true,
      future: false,
      quizLevel: 2,
    });
    expect(days.find((day) => day.date === "2026-08-07")).toMatchObject({
      active: false,
      future: true,
      quizLevel: 0,
    });
  });

  it("attaches the day detail to active days", () => {
    const one = detail("2026-08-03", 1);
    const days = calendarDays("2026-08", new Map([[one.date, one]]), "2026-08-31");
    const day = days.find((item) => item.date === one.date);
    expect(day?.detail).toEqual(one);
    expect(day?.quizLevel).toBe(activityLevel(1));
  });

  it("maps quiz counts to heat intensity levels", () => {
    expect(activityLevel(0)).toBe(0);
    expect(activityLevel(1)).toBe(1);
    expect(activityLevel(2)).toBe(2);
    expect(activityLevel(3)).toBe(2);
    expect(activityLevel(5)).toBe(3);
  });

  it("uses the supplied profile timezone rather than the browser timezone", () => {
    const instant = new Date("2026-08-01T00:30:00.000Z");

    expect(dateInTimezone(instant, "Asia/Ho_Chi_Minh")).toBe("2026-08-01");
    expect(dateInTimezone(instant, "America/Los_Angeles")).toBe("2026-07-31");
    expect(monthInTimezone(instant, "America/Los_Angeles")).toBe("2026-07");
  });

  it("navigates months without crossing calendar years incorrectly", () => {
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addMonths("2026-12", 1)).toBe("2027-01");
  });
});
