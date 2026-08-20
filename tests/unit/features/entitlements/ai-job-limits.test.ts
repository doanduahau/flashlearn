import { describe, expect, it } from "vitest";

import {
  AI_JOB_LIMITS,
  DOCUMENT_PROCESSING_LIMITS,
  calculateContentCredits,
} from "@/features/entitlements/ai-job-limits";

describe("AI job commercial limits", () => {
  it.each([
    [0, 0, 1],
    [5_000, 0, 1],
    [5_001, 0, 2],
    [0, 25, 1],
    [0, 26, 2],
    [10_001, 51, 6],
  ])("calculates content credits for %i chars and %i cards", (chars, cards, expected) => {
    expect(calculateContentCredits(chars, cards)).toBe(expected);
  });

  it("keeps Pro bounded while giving it higher document and concurrency limits", () => {
    expect(AI_JOB_LIMITS.free.concurrent).toBe(1);
    expect(AI_JOB_LIMITS.pro.concurrent).toBe(2);
    expect(AI_JOB_LIMITS.free.physicalCallsPerJob).toBe(5);
    expect(AI_JOB_LIMITS.pro.physicalCallsPerJob).toBe(20);
    expect(DOCUMENT_PROCESSING_LIMITS.pdf.free.cards).toBe(100);
    expect(DOCUMENT_PROCESSING_LIMITS.pdf.pro.cards).toBe(500);
    expect(DOCUMENT_PROCESSING_LIMITS.pdf.pro.pages).toBe(200);
  });
});
