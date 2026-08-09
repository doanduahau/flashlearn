import { describe, expect, it, vi } from "vitest";

import { loadSmartReviewResultContext } from "@/features/smart-review/utils/smart-review-result";

describe("loadSmartReviewResultContext", () => {
  it("does not load a library mastery snapshot for a manual quiz result", async () => {
    const loadSnapshot = vi.fn();

    await expect(loadSmartReviewResultContext("manual", loadSnapshot)).resolves.toEqual({
      kind: "manual",
    });
    expect(loadSnapshot).not.toHaveBeenCalled();
  });

  it("uses a fresh Smart Review candidate total rather than subtracting the completed batch", async () => {
    const loadSnapshot = vi.fn().mockResolvedValue({
      reviewCandidates: { total: 18, candidates: [] },
    });

    await expect(loadSmartReviewResultContext("smart_review", loadSnapshot)).resolves.toEqual({
      kind: "smart_review",
      remainingCount: 18,
    });
    expect(loadSnapshot).toHaveBeenCalledTimes(1);
  });

  it("keeps the zero-candidate outcome distinct from a disabled continuation", async () => {
    await expect(
      loadSmartReviewResultContext("smart_review", async () => ({
        reviewCandidates: { total: 0, candidates: [] },
      })),
    ).resolves.toEqual({ kind: "smart_review", remainingCount: 0 });
  });
});
