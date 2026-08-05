import { describe, expect, it } from "vitest";

import { sanitizeSearchQuery } from "@/features/flashcard-sets/utils/search";

describe("sanitizeSearchQuery", () => {
  it("trims and collapses whitespace", () => {
    expect(sanitizeSearchQuery("  Xin   chào  ")).toBe("Xin chào");
    expect(sanitizeSearchQuery("   ")).toBe("");
  });

  it("removes characters that would break PostgREST or ilike patterns", () => {
    expect(sanitizeSearchQuery("50% off")).toBe("50 off");
    expect(sanitizeSearchQuery("a_b")).toBe("ab");
    expect(sanitizeSearchQuery("a,b")).toBe("ab");
    expect(sanitizeSearchQuery("(paren)")).toBe("paren");
    expect(sanitizeSearchQuery("back\\slash")).toBe("backslash");
  });

  it("keeps Vietnamese and Unicode search terms", () => {
    expect(sanitizeSearchQuery("Ộ Ắ ừ")).toBe("Ộ Ắ ừ");
  });
});
