import { describe, expect, it } from "vitest";

import {
  IMPORT_REQUEST_LIMITS,
  STORAGE_PLAN_LIMITS,
  storagePlanTier,
} from "@/features/entitlements/storage-limits";

describe("storage entitlement mapping", () => {
  it("maps both paid plans to the same Pro storage tier", () => {
    expect(storagePlanTier("free")).toBe("free");
    expect(storagePlanTier("pro_monthly")).toBe("pro");
    expect(storagePlanTier("pro_yearly")).toBe("pro");
  });

  it("keeps approved Free and Pro totals in one typed source", () => {
    expect(STORAGE_PLAN_LIMITS.free).toEqual({
      sets: 20,
      cards: 3_000,
      collections: 10,
      cardSideChars: 5_000,
    });
    expect(STORAGE_PLAN_LIMITS.pro).toEqual({
      sets: 200,
      cards: 30_000,
      collections: 100,
      cardSideChars: 20_000,
    });
  });

  it("preserves deterministic 500/2000 request boundaries without AI quota", () => {
    for (const source of ["manual", "csv_xlsx", "google_sheets", "paste_structured"] as const) {
      expect(IMPORT_REQUEST_LIMITS[source].free.cards).toBe(500);
      expect(IMPORT_REQUEST_LIMITS[source].pro.cards).toBe(2_000);
    }
  });

  it("keeps prose and document generation limits separate", () => {
    expect(IMPORT_REQUEST_LIMITS.paste_prose).toMatchObject({
      free: { cards: 100, sourceChars: 25_000 },
      pro: { cards: 500, sourceChars: 100_000 },
    });
    expect(IMPORT_REQUEST_LIMITS.pdf.free.cards).toBe(100);
    expect(IMPORT_REQUEST_LIMITS.pdf.pro.cards).toBe(500);
  });
});
