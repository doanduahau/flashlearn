import { describe, expect, it } from "vitest";

import { mascotAssetPath } from "@/features/mascot/utils/mascot-asset";

describe("mascotAssetPath", () => {
  it("builds the path for a given level and state", () => {
    expect(mascotAssetPath(1, "run")).toBe("/mascot/level-1/run.png");
    expect(mascotAssetPath(5, "congrats")).toBe("/mascot/level-5/congrats.png");
  });

  it("covers every state", () => {
    const states = [
      "normal",
      "happy",
      "sad",
      "congrats",
      "run",
      "thinking",
      "point-right",
    ] as const;
    for (const state of states) {
      expect(mascotAssetPath(3, state)).toBe(`/mascot/level-3/${state}.png`);
    }
  });
});
