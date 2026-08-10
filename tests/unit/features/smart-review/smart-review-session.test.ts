import { describe, expect, it } from "vitest";

import type { FsrsDueCandidateResult } from "@/features/spaced-repetition/types/due-types";
import {
  SMART_REVIEW_BATCH_SIZE,
  smartReviewTargetCardIds,
} from "@/features/smart-review/utils/smart-review-session";

function candidates(count: number): FsrsDueCandidateResult {
  return {
    total: count,
    candidates: Array.from({ length: count }, (_, index) => ({
      flashcardId: `card-${index + 1}`,
      due: "2026-08-09T10:00:00.000Z",
      lastReview: "2026-08-08T10:00:00.000Z",
      state: 2,
    })),
  };
}

describe("smartReviewTargetCardIds", () => {
  it("returns no targets when there are no due candidates", () => {
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

  it("uses all candidates (caller applies limit)", () => {
    const result = smartReviewTargetCardIds(candidates(24));

    expect(SMART_REVIEW_BATCH_SIZE).toBe(10);
    expect(result).toHaveLength(24);
    expect(result.slice(0, 10)).toEqual([
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
