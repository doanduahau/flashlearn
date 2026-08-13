import { describe, expect, it } from "vitest";

import {
  LEARNING_FILTER_OPTIONS,
  applyLearningFilter,
  learningFilterToQuizMode,
  insufficientPoolMessage,
} from "@/features/learning-modes/types";

describe("learning mode filters", () => {
  it("exposes exactly Chưa làm / Câu sai / Ngẫu nhiên", () => {
    expect(LEARNING_FILTER_OPTIONS.map((option) => option.label)).toEqual([
      "Chưa làm",
      "Câu sai",
      "Ngẫu nhiên",
    ]);
  });

  it("maps Chưa làm to the never-tested quiz mode", () => {
    expect(learningFilterToQuizMode("unseen")).toBe("never_tested");
  });

  it("maps Câu sai to the wrong-answers quiz mode", () => {
    expect(learningFilterToQuizMode("wrong")).toBe("wrong_answers");
  });

  it("maps Ngẫu nhiên to the pure-random quiz mode", () => {
    expect(learningFilterToQuizMode("random")).toBe("pure_random");
  });

  it("strict Chưa làm keeps only uncovered ids (no backfill)", () => {
    const ids = ["a", "b", "c", "d"];
    const uncovered = new Set(["a", "c"]);
    const wrong = new Set(["b"]);
    expect(applyLearningFilter("unseen", ids, uncovered, wrong)).toEqual(["a", "c"]);
  });

  it("strict Câu sai keeps only wrong ids (no never-wrong backfill)", () => {
    const ids = ["a", "b", "c", "d"];
    const uncovered = new Set(["a", "c"]);
    const wrong = new Set(["b", "d"]);
    expect(applyLearningFilter("wrong", ids, uncovered, wrong)).toEqual(["b", "d"]);
  });

  it("Ngẫu nhiên keeps the whole pool", () => {
    const ids = ["a", "b", "c"];
    const uncovered = new Set(["a"]);
    const wrong = new Set(["b"]);
    expect(applyLearningFilter("random", ids, uncovered, wrong)).toEqual(["a", "b", "c"]);
  });

  it("provides filter-specific insufficient messages", () => {
    expect(insufficientPoolMessage("unseen")).toBe("Không đủ thẻ chưa làm để bắt đầu.");
    expect(insufficientPoolMessage("wrong")).toBe("Không đủ câu sai để bắt đầu.");
  });
});
