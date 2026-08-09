import { describe, expect, it } from "vitest";

import type { CardReviewOutcome } from "@/features/mastery/types/mastery-types";
import {
  deriveFlashcardMastery,
  MASTERY_V1,
} from "@/features/mastery/utils/derive-flashcard-mastery";

const NOW = "2026-08-09T12:00:00.000Z";

function event(daysAgo: number, isCorrect: boolean): CardReviewOutcome {
  return {
    isCorrect,
    reviewedAt: new Date(Date.parse(NOW) - daysAgo * 24 * 60 * 60 * 1000).toISOString(),
  };
}

describe("deriveFlashcardMastery", () => {
  it("marks cards with no events as untested", () => {
    expect(deriveFlashcardMastery([], NOW)).toEqual({
      status: "untested",
      score: null,
      reviewCount: 0,
      correctCount: 0,
      incorrectCount: 0,
      lastReviewedAt: null,
    });
  });

  it("does not make one recent correct answer strong", () => {
    const mastery = deriveFlashcardMastery([event(0, true)], NOW);

    expect(mastery.status).toBe("learning");
    expect(mastery.score).toBeLessThan(MASTERY_V1.strongThreshold);
  });

  it("increases mastery for repeated recent correct answers", () => {
    const oneCorrect = deriveFlashcardMastery([event(0, true)], NOW);
    const repeatedCorrect = deriveFlashcardMastery(
      [event(3, true), event(2, true), event(1, true), event(0, true)],
      NOW,
    );

    expect(repeatedCorrect.status).toBe("strong");
    expect(repeatedCorrect.score).toBeGreaterThan(oneCorrect.score ?? 0);
  });

  it("marks repeated incorrect answers for review", () => {
    const mastery = deriveFlashcardMastery(
      [event(3, false), event(2, false), event(1, false), event(0, false)],
      NOW,
    );

    expect(mastery.status).toBe("review");
    expect(mastery.incorrectCount).toBe(4);
  });

  it("lets a recent incorrect answer visibly reduce a strong history", () => {
    const strongHistory = [event(4, true), event(3, true), event(2, true), event(1, true)];
    const beforeMistake = deriveFlashcardMastery(strongHistory, NOW);
    const afterMistake = deriveFlashcardMastery([...strongHistory, event(0, false)], NOW);

    expect(beforeMistake.status).toBe("strong");
    expect(afterMistake.score).toBeLessThan(beforeMistake.score ?? 0);
    expect(afterMistake.status).not.toBe("strong");
  });

  it("allows recovery after mistakes without an unrealistic jump", () => {
    const mistakes = [event(3, false), event(2, false), event(1, false)];
    const beforeRecovery = deriveFlashcardMastery(mistakes, NOW);
    const recovery = deriveFlashcardMastery([...mistakes, event(0, true)], NOW);

    expect(recovery.score).toBeGreaterThan(beforeRecovery.score ?? 0);
    expect(recovery.status).toBe("review");
  });

  it("weights a recent mistake more than an old mistake", () => {
    const correctHistory = [event(4, true), event(3, true), event(2, true), event(1, true)];
    const recentMistake = deriveFlashcardMastery([...correctHistory, event(0, false)], NOW);
    const oldMistake = deriveFlashcardMastery([...correctHistory, event(90, false)], NOW);

    expect(recentMistake.score).toBeLessThan(oldMistake.score ?? 0);
  });

  it("decays confidence when the same history is evaluated much later", () => {
    const history = [event(3, true), event(2, true), event(1, true), event(0, true)];
    const current = deriveFlashcardMastery(history, NOW);
    const later = deriveFlashcardMastery(history, "2026-12-07T12:00:00.000Z");

    expect(later.score).toBeLessThan(current.score ?? 0);
    expect(later.status).toBe("review");
  });

  it("is deterministic and chronological for unsorted input", () => {
    const ordered = [event(3, true), event(2, false), event(1, true), event(0, true)];
    const unsorted = [ordered[2], ordered[0], ordered[3], ordered[1]];

    expect(deriveFlashcardMastery(unsorted, NOW)).toEqual(deriveFlashcardMastery(ordered, NOW));
    expect(deriveFlashcardMastery(unsorted, NOW)).toEqual(deriveFlashcardMastery(unsorted, NOW));
  });

  it("always bounds scores", () => {
    expect(
      deriveFlashcardMastery(
        Array.from({ length: 100 }, () => event(0, true)),
        NOW,
      ).score,
    ).toBe(MASTERY_V1.maximumScore);
    expect(
      deriveFlashcardMastery(
        Array.from({ length: 100 }, () => event(0, false)),
        NOW,
      ).score,
    ).toBe(MASTERY_V1.minimumScore);
  });
});
