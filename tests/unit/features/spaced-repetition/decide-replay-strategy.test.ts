import { describe, expect, it } from "vitest";

import { decideReplayStrategy } from "@/features/spaced-repetition/utils/decide-replay-strategy";
import type { ScheduleRow } from "@/features/spaced-repetition/server/schedule-repository";

function schedule(overrides: Partial<ScheduleRow> = {}): ScheduleRow {
  return {
    state: 1,
    stability: 2.3,
    difficulty: 2.1,
    due: "2026-08-09T12:10:00.000Z",
    scheduledDays: 0,
    learningSteps: 1,
    reps: 1,
    lapses: 0,
    lastReview: "2026-08-09T12:00:00.000Z",
    projectionRevision: 0,
    processedEventCount: 3,
    lastProcessedReviewedAt: "2026-08-09T12:05:00.000Z",
    lastProcessedReviewEventId: "e0000000-0000-4000-8000-000000000002",
    algorithm: "fsrs-6",
    implementation: "ts-fsrs@5.4.1",
    parameterSet: "flashlearn-v1",
    ...overrides,
  };
}

describe("decideReplayStrategy", () => {
  it("full replay when no schedule row exists", () => {
    const result = decideReplayStrategy(null, 5, true, 0);
    expect(result).toEqual({ replayMode: "full", reason: "no_schedule" });
  });

  it("full replay on config mismatch", () => {
    const s = schedule({ algorithm: "fsrs-5", parameterSet: "flashlearn-v0" });
    const result = decideReplayStrategy(s, 3, false, 0);
    expect(result.replayMode).toBe("full");
    expect(result.reason).toBe("config_mismatch");
  });

  it("no replay when count matches and config matches", () => {
    const s = schedule({ processedEventCount: 5 });
    const result = decideReplayStrategy(s, 5, true, 0);
    expect(result).toEqual({ replayMode: "none", reason: "up_to_date" });
  });

  it("full replay when DB count decreased below projection count", () => {
    const s = schedule({ processedEventCount: 10 });
    const result = decideReplayStrategy(s, 8, true, 0);
    expect(result).toEqual({ replayMode: "full", reason: "event_count_decreased" });
  });

  it("incremental replay when after cursor events equal the gap exactly", () => {
    // gap = total(8) - processed(5) = 3, after = 3
    const s = schedule({ processedEventCount: 5 });
    const result = decideReplayStrategy(s, 8, true, 3);
    expect(result).toEqual({ replayMode: "incremental", reason: "safe_incremental" });
  });

  it("full replay when there are late/out-of-order events", () => {
    // gap = total(8) - processed(5) = 3, but after cursor = 1
    const s = schedule({ processedEventCount: 5 });
    const result = decideReplayStrategy(s, 8, true, 1);
    expect(result).toEqual({ replayMode: "full", reason: "late_or_out_of_order" });
  });

  it("incremental when total = processed + after (even at large counts)", () => {
    const s = schedule({ processedEventCount: 1200 });
    const result = decideReplayStrategy(s, 1300, true, 100);
    expect(result.replayMode).toBe("incremental");
  });

  it("full when gap is positive but after is zero (events disappeared paradox)", () => {
    const s = schedule({ processedEventCount: 3 });
    const result = decideReplayStrategy(s, 5, true, 0);
    expect(result.replayMode).toBe("full");
  });
});
