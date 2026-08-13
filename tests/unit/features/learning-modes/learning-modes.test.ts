import { describe, expect, it } from "vitest";

import {
  LEARNING_FILTER_OPTIONS,
  learningFilterToQuizMode,
  priorityIdsForFilter,
} from "@/features/learning-modes/types";

describe("learning mode filters", () => {
  it("exposes exactly Chưa / Sai / Ngẫu nhiên", () => {
    expect(LEARNING_FILTER_OPTIONS.map((option) => option.label)).toEqual([
      "Chưa",
      "Sai",
      "Ngẫu nhiên",
    ]);
  });

  it("maps Chưa to the never-tested quiz mode", () => {
    expect(learningFilterToQuizMode("unseen")).toBe("never_tested");
  });

  it("maps Sai to the wrong-answers quiz mode", () => {
    expect(learningFilterToQuizMode("wrong")).toBe("wrong_answers");
  });

  it("maps Ngẫu nhiên to the pure-random quiz mode", () => {
    expect(learningFilterToQuizMode("random")).toBe("pure_random");
  });

  it("prioritises mode-specific uncovered ids for Chưa", () => {
    const uncovered = new Set(["a"]);
    const wrong = new Set(["b"]);
    expect(priorityIdsForFilter("unseen", uncovered, wrong)).toBe(uncovered);
  });

  it("prioritises the shared wrong-answer history for Sai", () => {
    const uncovered = new Set(["a"]);
    const wrong = new Set(["b"]);
    expect(priorityIdsForFilter("wrong", uncovered, wrong)).toBe(wrong);
  });

  it("keeps coverage fairness for Ngẫu nhiên", () => {
    const uncovered = new Set(["a"]);
    const wrong = new Set(["b"]);
    expect(priorityIdsForFilter("random", uncovered, wrong)).toBe(uncovered);
  });
});
