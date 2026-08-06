import { describe, expect, it } from "vitest";
import { accuracy, emptyStatistics, modeLabel } from "@/features/statistics/server/load-statistics";
describe("statistics helpers", () => {
  it("is zero-safe and rounds accuracy", () => {
    expect(accuracy(0, 0)).toBe(0);
    expect(accuracy(2, 3)).toBe(67);
  });
  it("uses readable mode labels", () => {
    expect(modeLabel("balanced")).toBe("Cân bằng");
    expect(modeLabel("pure_random")).toBe("Ngẫu nhiên");
  });
  it("has an accessible empty state model", () => {
    expect(emptyStatistics.current_streak).toBe(0);
    expect(emptyStatistics.daily_activity).toEqual([]);
  });
});
