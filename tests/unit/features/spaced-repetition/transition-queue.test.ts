import { describe, expect, it } from "vitest";

import type { FsrsDueCandidate } from "@/features/spaced-repetition/types/due-types";
import {
  buildFsrsTransitionQueue,
  classifyCandidate,
  type ClassifiedCandidate,
  type CursorEvent,
  type ScheduleCursor,
  SMART_REVIEW_BATCH_SIZE,
} from "@/features/spaced-repetition/utils/transition-queue";

const EVAL = "2026-08-09T12:00:00.000Z";

function candidate(
  overrides: Partial<FsrsDueCandidate> & { flashcardId?: string } = {},
): FsrsDueCandidate {
  return {
    flashcardId: overrides.flashcardId ?? "00000000-0000-4000-8000-000000000001",
    due: overrides.due ?? "2026-08-09T10:00:00.000Z",
    lastReview: overrides.lastReview ?? "2026-08-08T10:00:00.000Z",
    state: overrides.state ?? 1,
  };
}

function cursor(overrides: Partial<ScheduleCursor> = {}): ScheduleCursor {
  return {
    state: overrides.state ?? 1,
    scheduledDays: overrides.scheduledDays ?? 0,
    lastProcessedReviewEventId:
      overrides.lastProcessedReviewEventId ?? "c0000000-0000-4000-8000-000000000001",
  };
}

function event(overrides: Partial<CursorEvent> = {}): CursorEvent {
  return {
    fsrsRating: overrides.fsrsRating !== undefined ? overrides.fsrsRating : null,
    isCorrect: overrides.isCorrect !== undefined ? overrides.isCorrect : true,
  };
}

function classified(overrides: Partial<ClassifiedCandidate> = {}): ClassifiedCandidate {
  return {
    candidate: overrides.candidate ?? candidate(),
    classification: overrides.classification ?? "normal",
  };
}

// ---- classifyCandidate ----

describe("classifyCandidate", () => {
  it("Review state => normal", () => {
    expect(classifyCandidate(cursor({ state: 2 }), event({ fsrsRating: null }))).toBe("normal");
  });

  it("Learning + explicit rating 3 => normal", () => {
    expect(classifyCandidate(cursor({ state: 1 }), event({ fsrsRating: 3, isCorrect: true }))).toBe(
      "normal",
    );
  });

  it("Learning + explicit rating 1 => normal", () => {
    expect(
      classifyCandidate(cursor({ state: 1 }), event({ fsrsRating: 1, isCorrect: false })),
    ).toBe("normal");
  });

  it("Relearning + explicit rating => normal", () => {
    expect(classifyCandidate(cursor({ state: 3 }), event({ fsrsRating: 2 }))).toBe("normal");
  });

  it("Learning + scheduled_days=0 + null rating + binary correct => legacy", () => {
    expect(
      classifyCandidate(
        cursor({ state: 1, scheduledDays: 0 }),
        event({ fsrsRating: null, isCorrect: true }),
      ),
    ).toBe("legacy");
  });

  it("Learning + scheduled_days=0 + null rating + binary incorrect => legacy", () => {
    expect(
      classifyCandidate(
        cursor({ state: 1, scheduledDays: 0 }),
        event({ fsrsRating: null, isCorrect: false }),
      ),
    ).toBe("legacy");
  });

  it("Relearning + null rating + binary => legacy", () => {
    expect(
      classifyCandidate(
        cursor({ state: 3, scheduledDays: 0 }),
        event({ fsrsRating: null, isCorrect: true }),
      ),
    ).toBe("legacy");
  });

  it("future schedule => still classified (caller never passes undue)", () => {
    // classification only considers state/rating/scheduledDays, not due
    const c = cursor({ state: 1, scheduledDays: 0 });
    expect(classifyCandidate(c, event({ fsrsRating: null, isCorrect: true }))).toBe("legacy");
  });

  it("Review + null historical rating => normal", () => {
    expect(
      classifyCandidate(cursor({ state: 2 }), event({ fsrsRating: null, isCorrect: true })),
    ).toBe("normal");
  });

  it("missing cursor event => anomaly", () => {
    expect(classifyCandidate(cursor({ state: 1, scheduledDays: 0 }), null)).toBe("anomaly");
  });

  it("null rating + null is_correct => anomaly", () => {
    expect(
      classifyCandidate(
        cursor({ state: 1, scheduledDays: 0 }),
        event({ fsrsRating: null, isCorrect: null }),
      ),
    ).toBe("anomaly");
  });

  it("Learning + scheduled_days > 0 + binary => normal (not short-term)", () => {
    expect(
      classifyCandidate(
        cursor({ state: 1, scheduledDays: 1 }),
        event({ fsrsRating: null, isCorrect: true }),
      ),
    ).toBe("normal");
  });

  it("New state (0) + binary => normal", () => {
    expect(
      classifyCandidate(
        cursor({ state: 0, scheduledDays: 0 }),
        event({ fsrsRating: null, isCorrect: true }),
      ),
    ).toBe("normal");
  });
});

// ---- buildFsrsTransitionQueue ----

describe("buildFsrsTransitionQueue", () => {
  it("12 normal + 100 legacy => first 10 normal", () => {
    const items = [
      ...Array.from({ length: 12 }, (_, i) =>
        classified({ candidate: candidate({ flashcardId: `n${i}` }), classification: "normal" }),
      ),
      ...Array.from({ length: 100 }, (_, i) =>
        classified({ candidate: candidate({ flashcardId: `l${i}` }), classification: "legacy" }),
      ),
    ];
    const result = buildFsrsTransitionQueue(items, EVAL);
    expect(result.normalSelected).toBe(10);
    expect(result.legacySelected).toBe(0);
    expect(result.actionableNow).toBe(10);
  });

  it("7 normal + 100 legacy => 7 + 3", () => {
    const items = [
      ...Array.from({ length: 7 }, (_, i) =>
        classified({ candidate: candidate({ flashcardId: `n${i}` }), classification: "normal" }),
      ),
      ...Array.from({ length: 100 }, (_, i) =>
        classified({ candidate: candidate({ flashcardId: `l${i}` }), classification: "legacy" }),
      ),
    ];
    const result = buildFsrsTransitionQueue(items, EVAL);
    expect(result.normalSelected).toBe(7);
    expect(result.legacySelected).toBe(3);
    expect(result.actionableNow).toBe(10);
  });

  it("0 normal + 100 legacy => 10 legacy", () => {
    const items = Array.from({ length: 100 }, (_, i) =>
      classified({ candidate: candidate({ flashcardId: `l${i}` }), classification: "legacy" }),
    );
    const result = buildFsrsTransitionQueue(items, EVAL);
    expect(result.normalSelected).toBe(0);
    expect(result.legacySelected).toBe(10);
    expect(result.actionableNow).toBe(10);
  });

  it("actionableNow <= SMAR T_REVIEW_BATCH_SIZE", () => {
    const items = Array.from({ length: 5 }, (_, i) =>
      classified({ candidate: candidate({ flashcardId: `n${i}` }), classification: "normal" }),
    );
    const result = buildFsrsTransitionQueue(items, EVAL);
    expect(result.actionableNow).toBe(5);
    expect(result.actionableNow).toBeLessThanOrEqual(SMART_REVIEW_BATCH_SIZE);
  });

  it("deterministic ordering (due ASC, lastReview ASC, id ASC)", () => {
    const items = [
      classified({
        candidate: candidate({ flashcardId: "b", due: "2026-08-09T11:00:00.000Z" }),
        classification: "normal",
      }),
      classified({
        candidate: candidate({ flashcardId: "a", due: "2026-08-09T11:00:00.000Z" }),
        classification: "normal",
      }),
      classified({
        candidate: candidate({ flashcardId: "c", due: "2026-08-09T10:00:00.000Z" }),
        classification: "normal",
      }),
    ];
    const result = buildFsrsTransitionQueue(items, EVAL);
    expect(result.candidates[0]?.candidate.flashcardId).toBe("c");
  });

  it("fixed evaluationTime propagates", () => {
    const result = buildFsrsTransitionQueue([], EVAL);
    expect(result.evaluationTime).toBe(EVAL);
  });

  it("anomaly cards are treated as normal for queue (fail open)", () => {
    const items = [
      classified({
        candidate: candidate({ flashcardId: "a" }),
        classification: "anomaly",
      }),
      classified({
        candidate: candidate({ flashcardId: "b" }),
        classification: "anomaly",
      }),
    ];
    const result = buildFsrsTransitionQueue(items, EVAL);
    expect(result.normalDueTotal).toBe(2);
    expect(result.anomalyTotal).toBe(2);
    expect(result.actionableNow).toBe(2);
  });
});
