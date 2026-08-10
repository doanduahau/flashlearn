import { describe, expect, it } from "vitest";

import { smartReviewTargetCardIdsFromTransitionQueue } from "@/features/smart-review/utils/smart-review-session";
import { loadSmartReviewResultContext } from "@/features/smart-review/utils/smart-review-result";
import { buildFsrsTransitionQueue } from "@/features/spaced-repetition/utils/transition-queue";
import type { ClassifiedCandidate } from "@/features/spaced-repetition/utils/transition-queue";

const EVAL = "2026-08-09T12:00:00.000Z";

function makeCandidate(flashcardId: string, due: string): ClassifiedCandidate {
  return {
    candidate: {
      flashcardId,
      due,
      lastReview: "2026-08-08T10:00:00.000Z",
      state: 1,
    },
    classification: "normal",
  };
}

// ---- smartReviewTargetCardIdsFromTransitionQueue ----

describe("smartReviewTargetCardIdsFromTransitionQueue", () => {
  it("extracts card IDs from queue candidates in order", () => {
    const items: ClassifiedCandidate[] = [
      makeCandidate("a", "2026-08-09T09:00:00.000Z"),
      makeCandidate("b", "2026-08-09T10:00:00.000Z"),
      makeCandidate("c", "2026-08-09T11:00:00.000Z"),
    ];
    const queue = buildFsrsTransitionQueue(items, EVAL);
    const ids = smartReviewTargetCardIdsFromTransitionQueue(queue);
    expect(ids).toEqual(["a", "b", "c"]);
  });

  it("returns empty for empty queue", () => {
    const queue = buildFsrsTransitionQueue([], EVAL);
    expect(smartReviewTargetCardIdsFromTransitionQueue(queue)).toEqual([]);
  });

  it("includes legacy cards when they are in the queue", () => {
    const items: ClassifiedCandidate[] = [
      { ...makeCandidate("l1", "2026-08-09T10:00:00.000Z"), classification: "legacy" },
      { ...makeCandidate("l2", "2026-08-09T11:00:00.000Z"), classification: "legacy" },
    ];
    const queue = buildFsrsTransitionQueue(items, EVAL);
    expect(smartReviewTargetCardIdsFromTransitionQueue(queue)).toEqual(["l1", "l2"]);
  });
});

// ---- queue ordering: normal before legacy ----

describe("transition queue ordering", () => {
  it("normal candidates appear before legacy", () => {
    const items: ClassifiedCandidate[] = [
      { ...makeCandidate("l", "2026-08-09T10:00:00.000Z"), classification: "legacy" },
      { ...makeCandidate("n", "2026-08-09T10:00:00.000Z"), classification: "normal" },
    ];
    const queue = buildFsrsTransitionQueue(items, EVAL);
    expect(queue.candidates[0]?.candidate.flashcardId).toBe("n");
  });

  it("maximum 10 in session", () => {
    const items = Array.from({ length: 15 }, (_, i) =>
      makeCandidate(`n${i}`, "2026-08-09T10:00:00.000Z"),
    );
    const queue = buildFsrsTransitionQueue(items, EVAL);
    expect(queue.actionableNow).toBeLessThanOrEqual(10);
    expect(queue.candidates).toHaveLength(10);
  });

  it("zero actionable => empty candidates", () => {
    const queue = buildFsrsTransitionQueue([], EVAL);
    expect(queue.actionableNow).toBe(0);
    expect(queue.candidates).toHaveLength(0);
  });

  it("normalSelected + legacySelected = actionableNow", () => {
    const items: ClassifiedCandidate[] = [
      ...Array.from({ length: 7 }, (_, i) => ({
        ...makeCandidate(`n${i}`, "2026-08-09T10:00:00.000Z"),
        classification: "normal" as const,
      })),
      ...Array.from({ length: 8 }, (_, i) => ({
        ...makeCandidate(`l${i}`, "2026-08-09T11:00:00.000Z"),
        classification: "legacy" as const,
      })),
    ];
    const queue = buildFsrsTransitionQueue(items, EVAL);
    expect(queue.normalSelected + queue.legacySelected).toBe(queue.actionableNow);
    expect(queue.normalSelected).toBe(7);
    expect(queue.legacySelected).toBe(3);
  });
});

// ---- result continuation uses fresh actionableNow ----

describe("result continuation", () => {
  it("uses actionableNow, not a previous snapshot count", async () => {
    let callCount = 0;
    const loadQueue = () => {
      callCount += 1;
      return Promise.resolve({ actionableNow: callCount === 1 ? 5 : 3 });
    };

    const ctx1 = await loadSmartReviewResultContext("smart_review", loadQueue);
    expect(ctx1).toEqual({ kind: "smart_review", remainingCount: 5 });

    const ctx2 = await loadSmartReviewResultContext("smart_review", loadQueue);
    expect(ctx2).toEqual({ kind: "smart_review", remainingCount: 3 });
  });

  it("manual quiz context is not affected", async () => {
    const loadQueue = () => Promise.resolve({ actionableNow: 99 } as const);
    const ctx = await loadSmartReviewResultContext("manual", loadQueue);
    expect(ctx).toEqual({ kind: "manual" });
  });
});
