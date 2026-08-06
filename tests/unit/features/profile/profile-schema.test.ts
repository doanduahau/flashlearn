import { describe, expect, it } from "vitest";

import {
  findTimezone,
  isSupportedTimezone,
  TIMEZONE_GROUPS,
  TIMEZONE_OPTIONS,
} from "@/features/profile/constants/timezones";
import {
  updateProfileSchema,
  type UpdateProfileInput,
} from "@/features/profile/schemas/profile-schema";

function parse(input: unknown): UpdateProfileInput | null {
  const result = updateProfileSchema.safeParse(input);
  return result.success ? result.data : null;
}

describe("updateProfileSchema", () => {
  it("accepts a display name and a valid timezone", () => {
    expect(parse({ displayName: "Nguyễn Văn A", timezone: "Asia/Ho_Chi_Minh" })).toEqual({
      displayName: "Nguyễn Văn A",
      timezone: "Asia/Ho_Chi_Minh",
    });
  });

  it("accepts a missing display name as null", () => {
    expect(parse({ timezone: "Asia/Ho_Chi_Minh" })).toEqual({
      displayName: null,
      timezone: "Asia/Ho_Chi_Minh",
    });
  });

  it("treats a whitespace-only display name as null", () => {
    expect(parse({ displayName: "   ", timezone: "Europe/Paris" })).toEqual({
      displayName: null,
      timezone: "Europe/Paris",
    });
  });

  it("trims outer whitespace and preserves Vietnamese/Unicode", () => {
    expect(parse({ displayName: "  Trần Thị B 中文 ", timezone: "Asia/Ho_Chi_Minh" })).toEqual({
      displayName: "Trần Thị B 中文",
      timezone: "Asia/Ho_Chi_Minh",
    });
  });

  it("rejects a display name over the database limit", () => {
    const result = updateProfileSchema.safeParse({
      displayName: "x".repeat(101),
      timezone: "Asia/Ho_Chi_Minh",
    });
    expect(result.success).toBe(false);
  });

  it("accepts the default and widely spaced timezones", () => {
    for (const timezone of [
      "Asia/Ho_Chi_Minh",
      "Pacific/Kiritimati",
      "Pacific/Pago_Pago",
      "Europe/London",
    ]) {
      const result = updateProfileSchema.safeParse({ timezone });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.timezone).toBe(timezone);
      }
    }
  });

  it("rejects an invalid timezone", () => {
    const result = updateProfileSchema.safeParse({
      displayName: "A",
      timezone: "Mars/Olympus",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing timezone", () => {
    const result = updateProfileSchema.safeParse({ displayName: "A" });
    expect(result.success).toBe(false);
  });

  it("rejects a timezone that is a valid IANA name but not supported by the UI list", () => {
    const result = updateProfileSchema.safeParse({
      displayName: "A",
      timezone: "Asia/Khandyga",
    });
    expect(result.success).toBe(false);
  });
});

describe("timezone list", () => {
  it("exposes a deduplicated list of unique values", () => {
    const values = TIMEZONE_OPTIONS.map((option) => option.value);
    expect(new Set(values).size).toBe(values.length);
    expect(values.length).toBeGreaterThan(100);
  });

  it("includes the default timezone", () => {
    expect(isSupportedTimezone("Asia/Ho_Chi_Minh")).toBe(true);
  });

  it("groups options under labeled regions", () => {
    const groups = TIMEZONE_GROUPS.map((group) => group.group);
    expect(groups).toContain("Châu Á");
    expect(groups).toContain("Bắc Mỹ");
    for (const group of TIMEZONE_GROUPS) {
      expect(group.options.length).toBeGreaterThan(0);
    }
  });

  it("finds an option by value", () => {
    expect(findTimezone("Asia/Tokyo")?.group).toBe("Châu Á");
    expect(findTimezone("Mars/Olympus")).toBeUndefined();
  });
});
