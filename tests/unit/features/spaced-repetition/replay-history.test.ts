import { Rating } from "ts-fsrs";
import { describe, expect, it } from "vitest";

import { createCapyStudyScheduler } from "@/features/spaced-repetition/config";
import type { ReviewReplayFact } from "@/features/spaced-repetition/types/spaced-repetition-types";
import { replayReviewHistory } from "@/features/spaced-repetition/utils/replay-history";
import { computeRetrievability } from "@/features/spaced-repetition/utils/retrievability";

const T0 = "2026-08-09T12:00:00.000Z";
const T0_PLUS_5M = "2026-08-09T12:05:00.000Z";
const T0_PLUS_1D = "2026-08-10T12:00:00.000Z";

const scheduler = createCapyStudyScheduler();

function fact(
  eventId: string,
  reviewedAt: string,
  isCorrect: boolean | null,
  fsrsRating?: number | null,
): ReviewReplayFact {
  return { eventId, reviewedAt, isCorrect, fsrsRating };
}

function expectFiniteState(state: {
  stability: number;
  difficulty: number;
  reps: number;
  lapses: number;
}) {
  expect(Number.isFinite(state.stability)).toBe(true);
  expect(Number.isFinite(state.difficulty)).toBe(true);
  expect(Number.isInteger(state.reps)).toBe(true);
  expect(Number.isInteger(state.lapses)).toBe(true);
}

describe("replayReviewHistory", () => {
  it("returns null for zero events", () => {
    expect(replayReviewHistory([], scheduler)).toBeNull();
  });

  it("returns null when no event is schedulable", () => {
    const events = [fact("e1", T0, null), fact("e2", T0_PLUS_5M, null)];
    expect(replayReviewHistory(events, scheduler)).toBeNull();
  });

  it("produces a valid state for one correct event", () => {
    const state = replayReviewHistory([fact("e1", T0, true)], scheduler);
    expect(state).not.toBeNull();
    if (!state) throw new Error("Expected a scheduling state");
    expect(state.state).toBe("Learning");
    expect(state.due).toBe("2026-08-09T12:10:00.000Z");
    expect(state.reps).toBe(1);
    expect(state.lapses).toBe(0);
    expect(state.lastReview).toBe(T0);
    expect(state.stability).toBeGreaterThan(0);
    expect(state.difficulty).toBeGreaterThan(0);
    expectFiniteState(state);
  });

  it("produces a valid state for one incorrect event", () => {
    const state = replayReviewHistory([fact("e1", T0, false)], scheduler);
    expect(state).not.toBeNull();
    if (!state) throw new Error("Expected a scheduling state");
    expect(state.state).toBe("Learning");
    expect(state.due).toBe("2026-08-09T12:01:00.000Z");
    expect(state.reps).toBe(1);
    expect(state.lapses).toBe(0);
    expect(state.stability).toBeGreaterThan(0);
    expect(state.difficulty).toBeGreaterThan(0);
    expectFiniteState(state);
  });

  it("replays multiple events chronologically and grows stability", () => {
    const single = replayReviewHistory([fact("e1", T0, true)], scheduler);
    const repeated = replayReviewHistory(
      [fact("e1", T0, true), fact("e2", T0_PLUS_1D, true)],
      scheduler,
    );
    expect(repeated).not.toBeNull();
    expect(single).not.toBeNull();
    if (!repeated || !single) throw new Error("Expected scheduling states");
    expect(repeated.reps).toBe(2);
    expect(repeated.lapses).toBe(0);
    expect(repeated.stability).toBeGreaterThan(single.stability);
    expect(Date.parse(repeated.due)).toBeGreaterThan(Date.parse(T0_PLUS_1D));
  });

  it("is insensitive to input order (unsorted equals sorted)", () => {
    const ordered = [
      fact("e1", T0, true),
      fact("e2", T0_PLUS_1D, false),
      fact("e3", T0_PLUS_5M, true),
    ];
    const unsorted = [ordered[2], ordered[0], ordered[1]];
    expect(replayReviewHistory(unsorted, scheduler)).toEqual(
      replayReviewHistory(ordered, scheduler),
    );
  });

  it("uses a stable eventId ordering for identical reviewedAt", () => {
    const aFirst = [fact("a", T0, true), fact("b", T0, false)];
    const bFirst = [fact("b", T0, false), fact("a", T0, true)];

    const fromAFirst = replayReviewHistory(aFirst, scheduler);
    const fromBFirst = replayReviewHistory(bFirst, scheduler);
    expect(fromAFirst).toEqual(fromBFirst);

    // The deterministic tie-break processes "a" then "b": a correct then an incorrect.
    expect(fromAFirst?.reps).toBe(2);
    expect(fromAFirst?.lapses).toBe(0);
  });

  it("applies identical timestamps in stable eventId order regardless of input order", () => {
    const shuffled = [fact("b", T0, true), fact("a", T0, false)];
    const result = replayReviewHistory(shuffled, scheduler);
    // eventId "a" is processed before "b": incorrect (Again) then correct (Good).
    // Both occur inside the Learning state, so no lapse is recorded, and the
    // stable order is what determines the resulting due date.
    expect(result?.reps).toBe(2);
    expect(result?.lapses).toBe(0);
    expect(result?.due).toBe("2026-08-09T12:10:00.000Z");
  });

  it("replaying the same input twice produces deep-equivalent state", () => {
    const events = [fact("e1", T0, true), fact("e2", T0_PLUS_5M, false)];
    expect(replayReviewHistory(events, scheduler)).toEqual(replayReviewHistory(events, scheduler));
  });

  it("ignores a historical null event without altering state", () => {
    const baseline = [fact("e2", T0, true)];
    const withNull = [fact("e1", T0, null), fact("e2", T0, true)];
    expect(replayReviewHistory(withNull, scheduler)).toEqual(
      replayReviewHistory(baseline, scheduler),
    );
  });

  it("handles short-term reviews minutes apart without throwing or NaN", () => {
    const state = replayReviewHistory(
      [fact("e1", T0, false), fact("e2", T0_PLUS_5M, true)],
      scheduler,
    );
    expect(state).not.toBeNull();
    if (!state) throw new Error("Expected a scheduling state");
    expect(state.reps).toBe(2);
    expectFiniteState(state);
    expect(Number.isNaN(state.stability)).toBe(false);
    expect(Number.isNaN(state.difficulty)).toBe(false);
    expect(Number.isFinite(Date.parse(state.due))).toBe(true);
  });

  it("honors a stored rating at replay time", () => {
    const storedGood = replayReviewHistory([fact("e1", T0, false, Rating.Good)], scheduler);
    const plainGood = replayReviewHistory([fact("e1", T0, true)], scheduler);
    expect(storedGood).toEqual(plainGood);
  });

  it("never uses the current wall clock", () => {
    const before = replayReviewHistory([fact("e1", T0, true)], scheduler);
    const after = replayReviewHistory([fact("e1", T0, true)], scheduler);
    expect(before).toEqual(after);
    expect(before?.due).toBe("2026-08-09T12:10:00.000Z");
  });
});

describe("computeRetrievability", () => {
  it("is deterministic for a fixed evaluation time", () => {
    const first = computeRetrievability(10, 5);
    const second = computeRetrievability(10, 5);
    expect(first).toBe(second);
    expect(first).toBeGreaterThan(0);
    expect(first).toBeLessThan(1);
  });

  it("decays as elapsed days grow", () => {
    expect(computeRetrievability(10, 1)).toBeGreaterThan(computeRetrievability(10, 30));
  });
});
