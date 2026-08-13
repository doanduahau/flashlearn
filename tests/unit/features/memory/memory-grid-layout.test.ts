import { describe, expect, it } from "vitest";

import {
  DEFAULT_MEMORY_GRID_LAYOUT,
  computeMemoryGridLayout,
} from "@/features/memory/utils/memory-grid-layout";

describe("computeMemoryGridLayout", () => {
  it("always places exactly 12 tiles for a range of viewport sizes", () => {
    const sizes = [
      [334, 404],
      [390, 600],
      [700, 320],
      [704, 492],
      [500, 500],
      [1024, 700],
    ] as const;
    for (const [width, height] of sizes) {
      const layout = computeMemoryGridLayout(width, height);
      expect(layout.columns * layout.rows).toBe(12);
    }
  });

  it("picks 3x4 for a tall narrow 390x844-style grid area", () => {
    expect(computeMemoryGridLayout(334, 404)).toEqual({ columns: 3, rows: 4 });
  });

  it("switches to 6x2 on a wide short grid area", () => {
    expect(computeMemoryGridLayout(700, 320)).toEqual({ columns: 6, rows: 2 });
  });

  it("switches to 4x3 on a desktop-sized grid area", () => {
    expect(computeMemoryGridLayout(704, 492)).toEqual({ columns: 4, rows: 3 });
  });

  it("adapts the layout to the viewport aspect instead of freezing one shape", () => {
    const portrait = computeMemoryGridLayout(334, 404);
    const landscape = computeMemoryGridLayout(700, 320);
    expect(portrait).toEqual({ columns: 3, rows: 4 });
    expect(landscape).toEqual({ columns: 6, rows: 2 });
    expect(portrait).not.toEqual(landscape);
  });

  it("falls back to a 3x4 default when no candidate fits", () => {
    expect(computeMemoryGridLayout(10, 10)).toEqual(DEFAULT_MEMORY_GRID_LAYOUT);
  });

  it("respects a custom gap when choosing the layout", () => {
    for (const [width, height] of [
      [334, 404],
      [700, 320],
    ] as const) {
      const layout = computeMemoryGridLayout(width, height, 12);
      expect(layout.columns * layout.rows).toBe(12);
      expect(layout.columns).toBeGreaterThanOrEqual(2);
      expect(layout.columns).toBeLessThanOrEqual(6);
    }
  });
});
