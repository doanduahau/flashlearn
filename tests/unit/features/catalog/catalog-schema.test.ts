import { describe, expect, it } from "vitest";

import { catalogSetIdSchema, parseCatalogFilters } from "@/features/catalog/schemas/catalog-schema";

describe("catalog boundary schemas", () => {
  it("sanitizes invalid filters without accepting arrays", () => {
    expect(parseCatalogFilters({ q: ["ignored"], category: "../bad", language: "vi-en" })).toEqual({
      q: "",
      category: "",
      language: "vi-en",
      level: "",
    });
  });

  it("requires a UUID catalog set id", () => {
    expect(catalogSetIdSchema.safeParse("not-an-id").success).toBe(false);
    expect(catalogSetIdSchema.safeParse("20000000-0000-4000-8000-000000000001").success).toBe(true);
  });
});
