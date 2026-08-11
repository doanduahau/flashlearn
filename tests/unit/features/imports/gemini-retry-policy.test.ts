import { describe, expect, it } from "vitest";

import { GEMINI_RETRY_ATTEMPTS } from "@/features/imports/adapters/gemini-retry-policy";

describe("Gemini retry policy", () => {
  it("allows exactly one SDK attempt per logical provider request", () => {
    expect(GEMINI_RETRY_ATTEMPTS).toBe(1);
  });
});
