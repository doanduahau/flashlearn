import { describe, expect, it } from "vitest";

import { formatLocalTime } from "@/features/profile/utils/local-time";

const INSTANT = new Date("2026-08-06T00:00:00Z");

describe("formatLocalTime", () => {
  it("formats a UTC+7 instant on the same day", () => {
    expect(formatLocalTime(INSTANT, "Asia/Ho_Chi_Minh")).toBe("06/08/2026 07:00");
  });

  it("formats a UTC-11 instant on the previous day", () => {
    expect(formatLocalTime(INSTANT, "Pacific/Pago_Pago")).toBe("05/08/2026 13:00");
  });

  it("formats UTC at midnight with zero-padded hour", () => {
    expect(formatLocalTime(INSTANT, "UTC")).toBe("06/08/2026 00:00");
  });

  it("reflects the offset difference between two zones", () => {
    expect(formatLocalTime(INSTANT, "Pacific/Kiritimati")).toBe("06/08/2026 14:00");
  });
});
