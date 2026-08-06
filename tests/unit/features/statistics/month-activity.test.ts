import { describe, expect, it } from "vitest";

import {
  addMonths,
  calendarDays,
  dateInTimezone,
  monthInTimezone,
} from "@/features/statistics/utils/month-activity";

describe("monthly activity calendar", () => {
  it("fills leading blanks and identifies active, current, and future days", () => {
    const days = calendarDays("2026-08", new Set(["2026-08-06"]), "2026-08-06");

    expect(days.slice(0, 5).every((day) => day.day === null)).toBe(true);
    expect(days.find((day) => day.date === "2026-08-06")).toMatchObject({
      active: true,
      future: false,
    });
    expect(days.find((day) => day.date === "2026-08-07")).toMatchObject({
      active: false,
      future: true,
    });
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
