import { describe, expect, it } from "vitest";

import { rectsOverlap } from "@/features/runner/utils/collision";

describe("rectsOverlap", () => {
  const base = { x: 10, y: 10, width: 20, height: 20 };

  it("detects full containment", () => {
    expect(rectsOverlap(base, { x: 15, y: 15, width: 5, height: 5 })).toBe(true);
  });

  it("detects overlap from each direction", () => {
    expect(rectsOverlap(base, { x: 20, y: 10, width: 10, height: 20 })).toBe(true); // right
    expect(rectsOverlap(base, { x: 0, y: 10, width: 15, height: 20 })).toBe(true); // left
    expect(rectsOverlap(base, { x: 10, y: 20, width: 20, height: 10 })).toBe(true); // bottom
    expect(rectsOverlap(base, { x: 10, y: 0, width: 20, height: 15 })).toBe(true); // top
  });

  it("treats edge contact as not overlapping", () => {
    expect(rectsOverlap(base, { x: 30, y: 10, width: 10, height: 20 })).toBe(false); // right edge
    expect(rectsOverlap(base, { x: 10, y: 30, width: 20, height: 10 })).toBe(false); // bottom edge
  });

  it("returns false for clearly separated rects", () => {
    expect(rectsOverlap(base, { x: 100, y: 100, width: 10, height: 10 })).toBe(false);
  });
});
