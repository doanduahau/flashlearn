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
});
