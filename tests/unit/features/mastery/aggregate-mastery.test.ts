import { describe, expect, it } from "vitest";

import {
  aggregateMastery,
  EMPTY_MASTERY_AGGREGATE,
} from "@/features/mastery/utils/aggregate-mastery";
import type { MasteryStatus } from "@/features/mastery/types/mastery-types";

function statuses(...items: MasteryStatus[]) {
  return items.map((status) => ({ status }));
}

describe("aggregateMastery", () => {
  it("empty library => all counts zero", () => {
    expect(aggregateMastery([])).toEqual(EMPTY_MASTERY_AGGREGATE);
  });

  it("all never-tested cards => untested count equals the library size", () => {
    const result = aggregateMastery(statuses("untested", "untested", "untested"));
    expect(result.untested).toBe(3);
    expect(result.total).toBe(3);
    expect(result.review).toBe(0);
    expect(result.learning).toBe(0);
    expect(result.strong).toBe(0);
  });

  it("mixed review/learning/strong/untested => exact aggregate", () => {
    const result = aggregateMastery(
      statuses("review", "untested", "strong", "learning", "review", "untested", "strong"),
    );
    expect(result).toEqual({
      total: 7,
      untested: 2,
      review: 2,
      learning: 1,
      strong: 2,
    });
  });

  it("total invariant holds for arbitrary inputs", () => {
    const samples: MasteryStatus[][] = [
      [],
      ["untested"],
      ["review", "review", "review"],
      ["learning", "strong", "untested", "review", "strong", "learning", "untested"],
      Array.from({ length: 235 }, (_, index) =>
        index % 4 === 0
          ? "untested"
          : index % 4 === 1
            ? "review"
            : index % 4 === 2
              ? "learning"
              : "strong",
      ),
    ];
    for (const sample of samples) {
      const result = aggregateMastery(statuses(...sample));
      expect(result.total).toBe(sample.length);
      expect(result.total).toBe(result.untested + result.review + result.learning + result.strong);
    }
  });

  it("does not invent cards from nothing", () => {
    const result = aggregateMastery([{ status: "untested" as const }]);
    expect(result.untested).toBe(1);
    expect(result.total).toBe(1);
  });
});
