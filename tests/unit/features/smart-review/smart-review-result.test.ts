import { describe, expect, it, vi } from "vitest";

import { loadSmartReviewResultContext } from "@/features/smart-review/utils/smart-review-result";

describe("loadSmartReviewResultContext", () => {
  it("does not load a due count for a manual quiz result", async () => {
    const loadDueCount = vi.fn();

    await expect(loadSmartReviewResultContext("manual", loadDueCount)).resolves.toEqual({
      kind: "manual",
    });
    expect(loadDueCount).not.toHaveBeenCalled();
  });

  it("uses a fresh FSRS due total rather than subtracting the completed batch", async () => {
    const loadDueCount = vi.fn().mockResolvedValue({ total: 97 });

    await expect(loadSmartReviewResultContext("smart_review", loadDueCount)).resolves.toEqual({
      kind: "smart_review",
      remainingCount: 97,
    });
    expect(loadDueCount).toHaveBeenCalledTimes(1);
  });

  it("may show >10 remaining", async () => {
    await expect(
      loadSmartReviewResultContext("smart_review", async () => ({ total: 107 })),
    ).resolves.toEqual({ kind: "smart_review", remainingCount: 107 });
  });

  it("keeps the zero-total outcome distinct from a disabled continuation", async () => {
    await expect(
      loadSmartReviewResultContext("smart_review", async () => ({ total: 0 })),
    ).resolves.toEqual({ kind: "smart_review", remainingCount: 0 });
  });

  it("loads a fresh full New Card count only for a persisted new_cards origin", async () => {
    const loadDueCount = vi.fn();
    const loadNewCardsCount = vi.fn().mockResolvedValue({ total: 14 });

    await expect(
      loadSmartReviewResultContext("new_cards", loadDueCount, loadNewCardsCount),
    ).resolves.toEqual({ kind: "new_cards", remainingCount: 14 });
    expect(loadDueCount).not.toHaveBeenCalled();
    expect(loadNewCardsCount).toHaveBeenCalledTimes(1);
  });

  it("does not load New Card counts for a Smart Review result", async () => {
    const loadDueCount = vi.fn().mockResolvedValue({ total: 3 });
    const loadNewCardsCount = vi.fn();

    await loadSmartReviewResultContext("smart_review", loadDueCount, loadNewCardsCount);

    expect(loadNewCardsCount).not.toHaveBeenCalled();
  });
});
