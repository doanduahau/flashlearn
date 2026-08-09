import { describe, expect, it } from "vitest";

import type { SmartReviewCandidateResult } from "@/features/mastery/types/mastery-types";
import {
  SMART_REVIEW_BATCH_SIZE,
  smartReviewTargetCardIds,
} from "@/features/smart-review/utils/smart-review-session";

function candidates(count: number): SmartReviewCandidateResult {
  return {
    total: count,
    candidates: Array.from({ length: count }, (_, index) => ({
      flashcardId: `card-${index + 1}`,
      status: "review" as const,
      score: index,
      lastReviewedAt: "2026-08-10T12:00:00.000Z",
    })),
  };
}

describe("smartReviewTargetCardIds", () => {
  it("returns no targets when there are no review candidates", () => {
    expect(smartReviewTargetCardIds(candidates(0))).toEqual([]);
  });

  it("uses every candidate below the fixed batch size", () => {
    expect(smartReviewTargetCardIds(candidates(1))).toEqual(["card-1"]);
    expect(smartReviewTargetCardIds(candidates(6))).toEqual([
      "card-1",
      "card-2",
      "card-3",
      "card-4",
      "card-5",
      "card-6",
    ]);
  });

  it("uses the first ten urgency-ranked candidates without reordering them", () => {
    const result = smartReviewTargetCardIds(candidates(24));

    expect(SMART_REVIEW_BATCH_SIZE).toBe(10);
    expect(result).toEqual([
      "card-1",
      "card-2",
      "card-3",
      "card-4",
      "card-5",
      "card-6",
      "card-7",
      "card-8",
      "card-9",
      "card-10",
    ]);
  });
});
