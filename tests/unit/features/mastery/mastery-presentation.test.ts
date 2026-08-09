import { describe, expect, it } from "vitest";

import {
  getMasteryPresentation,
  MASTERY_STATUS_LABELS,
  masteryCardClassName,
} from "@/features/mastery/presentation/mastery-presentation";
import type { MasteryStatus } from "@/features/mastery/types/mastery-types";

describe("getMasteryPresentation", () => {
  it("maps untested to a neutral gray presentation", () => {
    const presentation = getMasteryPresentation("untested");
    expect(presentation.label).toBe("Chưa học");
    expect(presentation.cardClassName).toContain("mastery-untested");
    expect(presentation.cardClassName).not.toContain("mastery-review");
    expect(presentation.cardClassName).not.toContain("mastery-learning");
    expect(presentation.cardClassName).not.toContain("mastery-strong");
  });

  it("maps review to a soft-red presentation", () => {
    const presentation = getMasteryPresentation("review");
    expect(presentation.label).toBe("Cần ôn");
    expect(presentation.cardClassName).toContain("mastery-review");
    expect(presentation.cardClassName).not.toContain("mastery-untested");
    expect(presentation.cardClassName).not.toContain("mastery-learning");
    expect(presentation.cardClassName).not.toContain("mastery-strong");
  });

  it("maps learning to a soft-yellow presentation", () => {
    const presentation = getMasteryPresentation("learning");
    expect(presentation.label).toBe("Đang học");
    expect(presentation.cardClassName).toContain("mastery-learning");
    expect(presentation.cardClassName).not.toContain("mastery-untested");
    expect(presentation.cardClassName).not.toContain("mastery-review");
    expect(presentation.cardClassName).not.toContain("mastery-strong");
  });

  it("maps strong to a soft-green presentation", () => {
    const presentation = getMasteryPresentation("strong");
    expect(presentation.label).toBe("Đã nhớ");
    expect(presentation.cardClassName).toContain("mastery-strong");
    expect(presentation.cardClassName).not.toContain("mastery-untested");
    expect(presentation.cardClassName).not.toContain("mastery-review");
    expect(presentation.cardClassName).not.toContain("mastery-learning");
  });

  it("exposes a small indicator class for every status", () => {
    for (const status of ["untested", "review", "learning", "strong"] as const) {
      expect(getMasteryPresentation(status).indicatorClassName).toContain("mastery");
    }
  });

  it("never exposes a raw score or percentage", () => {
    for (const status of ["untested", "review", "learning", "strong"] as const) {
      const label = getMasteryPresentation(status).label;
      expect(label).not.toMatch(/\d/);
      expect(label).not.toMatch(/%|điểm|score/i);
    }
  });

  it("composes the full card class list with the mastery tint winning", () => {
    expect(masteryCardClassName("untested")).toContain("border-mastery-untested-border");
    expect(masteryCardClassName("untested")).toContain("bg-mastery-untested");
    expect(masteryCardClassName("review")).toContain("border-mastery-review-border");
    expect(masteryCardClassName("review")).toContain("bg-mastery-review");
    expect(masteryCardClassName("learning")).toContain("border-mastery-learning-border");
    expect(masteryCardClassName("learning")).toContain("bg-mastery-learning");
    expect(masteryCardClassName("strong")).toContain("border-mastery-strong-border");
    expect(masteryCardClassName("strong")).toContain("bg-mastery-strong");
  });

  it("keeps the base card treatment so list density is unchanged", () => {
    for (const status of ["untested", "review", "learning", "strong"] as const) {
      const className = masteryCardClassName(status);
      expect(className).toContain("rounded-2xl");
      expect(className).toContain("p-4");
      expect(className).toContain("sm:p-5");
    }
  });
});

describe("MASTERY_STATUS_LABELS", () => {
  it("uses only user-facing Vietnamese names", () => {
    expect(MASTERY_STATUS_LABELS).toEqual({
      untested: "Chưa học",
      review: "Cần ôn",
      learning: "Đang học",
      strong: "Đã nhớ",
    });
  });

  it("does not leak implementation terminology", () => {
    const values = Object.values(MASTERY_STATUS_LABELS).join(" ");
    expect(values).not.toMatch(/mastery|decay|confidence|half-life|score|điểm|phần trăm/i);
  });
});

describe("masteryCardClassName typing", () => {
  it("accepts any MasteryStatus value", () => {
    const statuses: readonly MasteryStatus[] = ["untested", "review", "learning", "strong"];
    for (const status of statuses) {
      expect(masteryCardClassName(status)).toBeTruthy();
    }
  });
});
