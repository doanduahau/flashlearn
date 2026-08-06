import { describe, expect, it } from "vitest";

import { streakLabel } from "@/features/statistics/utils/streak-label";

describe("streakLabel", () => {
  it("describes an active streak", () => {
    expect(streakLabel(7, true)).toBe("Chuỗi 7 ngày, hôm nay đã hoàn thành");
  });

  it("describes an inactive streak", () => {
    expect(streakLabel(0, false)).toBe("Chuỗi 0 ngày, hôm nay chưa hoàn thành");
  });
});
