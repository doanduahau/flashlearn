import { describe, expect, it, vi } from "vitest";

import { loadSmartReviewResultContext } from "@/features/smart-review/utils/smart-review-result";

describe("loadSmartReviewResultContext", () => {
  it("does not load a transition queue for a manual quiz result", async () => {
    const loadQueue = vi.fn();

    await expect(loadSmartReviewResultContext("manual", loadQueue)).resolves.toEqual({
      kind: "manual",
    });
    expect(loadQueue).not.toHaveBeenCalled();
  });

  it("uses a fresh transition queue actionableNow rather than subtracting the completed batch", async () => {
    const loadQueue = vi.fn().mockResolvedValue({ actionableNow: 18 });

    await expect(loadSmartReviewResultContext("smart_review", loadQueue)).resolves.toEqual({
      kind: "smart_review",
      remainingCount: 18,
    });
    expect(loadQueue).toHaveBeenCalledTimes(1);
  });

  it("keeps the zero-candidate outcome distinct from a disabled continuation", async () => {
    await expect(
      loadSmartReviewResultContext("smart_review", async () => ({ actionableNow: 0 })),
    ).resolves.toEqual({ kind: "smart_review", remainingCount: 0 });
  });
});
