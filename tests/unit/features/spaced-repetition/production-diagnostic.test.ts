import { describe, expect, it } from "vitest";

import {
  ALLOWED_PRODUCTION_PROJECT_REFS as diagnosticAllowlist,
  resolveProductionIdentity as diagnosticResolve,
  validateProductionIdentity as diagnosticValidate,
} from "@/../scripts/fsrs-diagnose-production";
import {
  ALLOWED_PRODUCTION_PROJECT_REFS as reconcileAllowlist,
  resolveProductionIdentity as reconcileResolve,
  validateProductionIdentity as reconcileValidate,
} from "@/../scripts/fsrs-reconcile-production";
import {
  analyzeOneReview,
  analyzeReviewState,
  analyzeShortTermLearning,
  checkSchedulerMismatches,
  classifyByLastReviewAge,
  classifyByOverdue,
  classifyByReviewCount,
  classifyByState,
  classifyLastEventOutcome,
  computePercentile,
  crossTabMastery,
  type FsrsOnlyCardDetail,
  type MasteryCardInfo,
  sumAgeBuckets,
  sumLastEventOutcomes,
  sumMasteryCrossTabs,
  sumReviewCountBuckets,
  sumStateBuckets,
} from "@/features/spaced-repetition/utils/diagnose-due-divergence";

const T0 = "2026-08-09T12:00:00.000Z";

function card(
  overrides: Partial<FsrsOnlyCardDetail> & { flashcardId: string },
): FsrsOnlyCardDetail {
  return {
    flashcardId: overrides.flashcardId,
    state: overrides.state ?? 2,
    due: overrides.due ?? "2026-08-09T11:00:00.000Z",
    lastReview:
      overrides.lastReview !== undefined ? overrides.lastReview : "2026-08-09T10:00:00.000Z",
    scheduledDays: overrides.scheduledDays ?? 0,
    processedEventCount: overrides.processedEventCount ?? 2,
    learningSteps: overrides.learningSteps ?? 0,
    algorithm: overrides.algorithm ?? "fsrs-6",
    implementation: overrides.implementation ?? "ts-fsrs@5.4.1",
    parameterSet: overrides.parameterSet ?? "flashlearn-v1",
    lastEventFsrsRating:
      overrides.lastEventFsrsRating !== undefined ? overrides.lastEventFsrsRating : 3,
    lastEventIsCorrect:
      overrides.lastEventIsCorrect !== undefined ? overrides.lastEventIsCorrect : null,
  };
}

function mastery(
  flashcardId: string,
  status: MasteryCardInfo["status"],
  score: number | null,
): MasteryCardInfo {
  return { flashcardId, status, score };
}

// ---- Identity guard reuse ----

describe("production identity guard is reused", () => {
  it("diagnostic command uses the exact same guard functions as the reconciliation runner", () => {
    expect(diagnosticResolve).toBe(reconcileResolve);
    expect(diagnosticValidate).toBe(reconcileValidate);
  });

  it("diagnostic command uses the same production allowlist", () => {
    expect(diagnosticAllowlist).toBe(reconcileAllowlist);
    expect(diagnosticAllowlist.has("rtrllrlilupoesikeypt")).toBe(true);
  });

  it("fails closed on a non-allowlisted project ref", () => {
    const identity = {
      url: "https://otherproject.supabase.co",
      projectRef: "otherproject",
      serviceRoleKey: "k",
    };
    expect(() => diagnosticValidate(identity, diagnosticAllowlist)).toThrow(
      /not in the production allowlist/,
    );
  });

  it("resolveProductionIdentity fails closed when credentials are missing", () => {
    expect(() => diagnosticResolve({}, diagnosticAllowlist)).toThrow(
      /FLASHLEARN_PRODUCTION_SUPABASE_URL/,
    );
    expect(() =>
      diagnosticResolve(
        {
          FLASHLEARN_PRODUCTION_SUPABASE_URL: "https://rtrllrlilupoesikeypt.supabase.co",
          FLASHLEARN_PRODUCTION_PROJECT_REF: "rtrllrlilupoesikeypt",
        },
        diagnosticAllowlist,
      ),
    ).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });
});

// ---- classifyByState ----

describe("classifyByState", () => {
  it("classifies by state number: 0=New, 1=Learning, 2=Review, 3=Relearning", () => {
    const details = [
      card({ flashcardId: "a", state: 0 }),
      card({ flashcardId: "b", state: 1 }),
      card({ flashcardId: "c", state: 1 }),
      card({ flashcardId: "d", state: 2 }),
      card({ flashcardId: "e", state: 2 }),
      card({ flashcardId: "f", state: 2 }),
      card({ flashcardId: "g", state: 3 }),
    ];
    expect(classifyByState(details)).toEqual({
      New: 1,
      Learning: 2,
      Review: 3,
      Relearning: 1,
    });
  });

  it("handles empty", () => {
    expect(classifyByState([])).toEqual({ New: 0, Learning: 0, Review: 0, Relearning: 0 });
  });
});

// ---- classifyByReviewCount ----

describe("classifyByReviewCount", () => {
  it("buckets by processedEventCount: 1,2,3,4,5-9,10+", () => {
    const details = [
      card({ flashcardId: "a", processedEventCount: 1 }),
      card({ flashcardId: "b", processedEventCount: 2 }),
      card({ flashcardId: "c", processedEventCount: 2 }),
      card({ flashcardId: "d", processedEventCount: 3 }),
      card({ flashcardId: "e", processedEventCount: 4 }),
      card({ flashcardId: "f", processedEventCount: 5 }),
      card({ flashcardId: "g", processedEventCount: 9 }),
      card({ flashcardId: "h", processedEventCount: 10 }),
      card({ flashcardId: "i", processedEventCount: 50 }),
    ];
    expect(classifyByReviewCount(details)).toEqual({
      count1: 1,
      count2: 2,
      count3: 1,
      count4: 1,
      count5to9: 2,
      count10Plus: 2,
    });
  });

  it("handles zero processedEventCount", () => {
    expect(classifyByReviewCount([card({ flashcardId: "a", processedEventCount: 0 })])).toEqual({
      count1: 0,
      count2: 0,
      count3: 0,
      count4: 0,
      count5to9: 0,
      count10Plus: 0,
    });
  });
});

// ---- classifyByLastReviewAge ----

describe("classifyByLastReviewAge", () => {
  it("buckets by hours from lastReview to evaluationTime", () => {
    const details = [
      card({ flashcardId: "a", lastReview: "2026-08-09T11:30:00.000Z" }), // 0.5h
      card({ flashcardId: "b", lastReview: "2026-08-08T13:00:00.000Z" }), // 23h
      card({ flashcardId: "c", lastReview: "2026-08-05T12:00:00.000Z" }), // 4d
      card({ flashcardId: "d", lastReview: "2026-07-20T12:00:00.000Z" }), // 20d
      card({ flashcardId: "e", lastReview: "2026-06-10T12:00:00.000Z" }), // 60d
      card({ flashcardId: "f", lastReview: "2026-04-10T12:00:00.000Z" }), // 121d
      card({ flashcardId: "g", lastReview: null }),
    ];
    expect(classifyByLastReviewAge(details, T0)).toEqual({
      lt1h: 1,
      h1to24h: 1,
      d1to7: 1,
      d7to30: 1,
      d30to90: 1,
      gt90d: 2, // null + 121d
    });
  });
});

// ---- classifyByOverdue ----

describe("classifyByOverdue", () => {
  it("buckets by evaluationTime - due", () => {
    const details = [
      card({ flashcardId: "a", due: "2026-08-09T11:30:00.000Z" }), // 0.5h overdue
      card({ flashcardId: "b", due: "2026-08-08T13:00:00.000Z" }), // 23h
      card({ flashcardId: "c", due: "2026-08-05T12:00:00.000Z" }), // 4d
      card({ flashcardId: "d", due: "2026-07-20T12:00:00.000Z" }), // 20d
      card({ flashcardId: "e", due: "2026-06-10T12:00:00.000Z" }), // 60d
      card({ flashcardId: "f", due: "2026-04-10T12:00:00.000Z" }), // 121d
    ];
    const result = classifyByOverdue(details, T0);
    expect(result.within1h).toBe(1);
    expect(result.h1to24h).toBe(1);
    expect(result.d1to7).toBe(1);
    expect(result.d7to30).toBe(1);
    expect(result.d30to90).toBe(1);
    expect(result.gt90d).toBe(1);
  });

  it("computes median, p90, max hours", () => {
    const details = [
      card({ flashcardId: "a", due: "2026-08-09T11:45:00.000Z" }), // 0.25h
      card({ flashcardId: "b", due: "2026-08-09T09:00:00.000Z" }), // 3h
      card({ flashcardId: "c", due: "2026-08-09T06:00:00.000Z" }), // 6h
      card({ flashcardId: "d", due: "2026-08-08T12:00:00.000Z" }), // 24h
      card({ flashcardId: "e", due: "2026-07-20T12:00:00.000Z" }), // 480h
    ];
    const result = classifyByOverdue(details, T0);
    expect(result.medianHours).toBeCloseTo(6, 1);
    expect(result.p90Hours).toBeCloseTo(480, 1);
    expect(result.maxHours).toBeCloseTo(480, 1);
  });

  it("handles empty", () => {
    const result = classifyByOverdue([], T0);
    expect(result.within1h).toBe(0);
    expect(result.medianHours).toBe(0);
    expect(result.maxHours).toBe(0);
  });
});

// ---- classifyLastEventOutcome ----

describe("classifyLastEventOutcome", () => {
  it("classifies by fsrs rating with binary fallback", () => {
    const details = [
      card({ flashcardId: "a", lastEventFsrsRating: 1 }),
      card({ flashcardId: "b", lastEventFsrsRating: 2 }),
      card({ flashcardId: "c", lastEventFsrsRating: 3 }),
      card({ flashcardId: "d", lastEventFsrsRating: 3 }),
      card({ flashcardId: "e", lastEventFsrsRating: 4 }),
      card({ flashcardId: "f", lastEventFsrsRating: null, lastEventIsCorrect: true }),
      card({ flashcardId: "g", lastEventFsrsRating: null, lastEventIsCorrect: false }),
      card({ flashcardId: "h", lastEventFsrsRating: null, lastEventIsCorrect: null }),
    ];
    expect(classifyLastEventOutcome(details)).toEqual({
      again: 1,
      hard: 1,
      good: 2,
      easy: 1,
      binaryIncorrect: 1,
      binaryCorrect: 1,
      unknown: 1,
    });
  });
});

// ---- crossTabMastery ----

describe("crossTabMastery", () => {
  it("cross-tabs by Mastery status and score buckets", () => {
    const details = [
      card({ flashcardId: "a" }),
      card({ flashcardId: "b" }),
      card({ flashcardId: "c" }),
      card({ flashcardId: "d" }),
      card({ flashcardId: "e" }),
      card({ flashcardId: "f" }),
    ];
    const map = new Map([
      ["b", mastery("b", "review", 30)],
      ["c", mastery("c", "learning", 55)],
      ["d", mastery("d", "strong", 80)],
      ["e", mastery("e", "strong", 95)],
    ]);
    const result = crossTabMastery(details, map);
    expect(result.untested).toBe(2); // a, f not in map
    expect(result.review).toBe(1); // b
    expect(result.learning).toBe(1); // c
    expect(result.strong).toBe(2); // d, e
    expect(result.scoreBuckets.sc21to40).toBe(1);
    expect(result.scoreBuckets.sc41to60).toBe(1);
    expect(result.scoreBuckets.sc61to80).toBe(1);
    expect(result.scoreBuckets.sc81to100).toBe(1);
    expect(result.scoreBuckets.noScore).toBe(2); // a, f
  });

  it("handles null score", () => {
    const details = [card({ flashcardId: "x" })];
    const map = new Map([["x", mastery("x", "strong", null) as MasteryCardInfo]]);
    const result = crossTabMastery(details, map);
    expect(result.strong).toBe(1);
    expect(result.scoreBuckets.noScore).toBe(1);
  });
});

// ---- analyzeOneReview ----

describe("analyzeOneReview", () => {
  it("only looks at processedEventCount === 1", () => {
    const details = [
      card({
        flashcardId: "a",
        processedEventCount: 1,
        lastEventFsrsRating: 3,
        lastReview: "2026-08-08T12:00:00.000Z",
      }),
      card({ flashcardId: "b", processedEventCount: 2, lastEventFsrsRating: 1 }),
      card({
        flashcardId: "c",
        processedEventCount: 1,
        lastEventFsrsRating: 1,
        lastReview: "2026-08-07T12:00:00.000Z",
      }),
    ];
    const result = analyzeOneReview(details, T0);
    expect(result.count).toBe(2);
    expect(result.correctCount).toBe(1);
    expect(result.incorrectCount).toBe(1);
  });

  it("categorizes one-review cards by state", () => {
    const details = [
      card({ flashcardId: "a", processedEventCount: 1, state: 1 }),
      card({ flashcardId: "b", processedEventCount: 1, state: 2 }),
      card({ flashcardId: "c", processedEventCount: 1, state: 2 }),
      card({ flashcardId: "d", processedEventCount: 1, state: 3 }),
    ];
    const result = analyzeOneReview(details, T0);
    expect(result.stateLearning).toBe(1);
    expect(result.stateReview).toBe(2);
    expect(result.stateRelearning).toBe(1);
  });

  it("computes median days since last review", () => {
    const details = [
      card({ flashcardId: "a", processedEventCount: 1, lastReview: "2026-08-08T12:00:00.000Z" }), // 1d
      card({ flashcardId: "b", processedEventCount: 1, lastReview: "2026-08-06T12:00:00.000Z" }), // 3d
      card({ flashcardId: "c", processedEventCount: 1, lastReview: "2026-08-03T12:00:00.000Z" }), // 6d
    ];
    const result = analyzeOneReview(details, T0);
    expect(result.medianDaysSinceReview).toBeCloseTo(3, 1);
  });
});

// ---- analyzeShortTermLearning ----

describe("analyzeShortTermLearning", () => {
  it("counts state=1 or 3 where scheduledDays === 0", () => {
    const details = [
      card({ flashcardId: "a", state: 1, scheduledDays: 0 }),
      card({ flashcardId: "b", state: 1, scheduledDays: 0 }),
      card({ flashcardId: "c", state: 2, scheduledDays: 0 }), // Review, not counted
      card({ flashcardId: "d", state: 3, scheduledDays: 0 }),
      card({ flashcardId: "e", state: 1, scheduledDays: 1 }), // days > 0
      card({ flashcardId: "f", state: 0, scheduledDays: 0 }), // New
    ];
    const result = analyzeShortTermLearning(details);
    expect(result.count).toBe(3);
    expect(result.stateLearning).toBe(2);
    expect(result.stateRelearning).toBe(1);
  });
});

// ---- analyzeReviewState ----

describe("analyzeReviewState", () => {
  it("filters to state===2 only", () => {
    const details = [
      card({ flashcardId: "a", state: 2, processedEventCount: 3, due: "2026-08-09T11:00:00.000Z" }),
      card({ flashcardId: "b", state: 1 }),
      card({ flashcardId: "c", state: 2, processedEventCount: 5, due: "2026-08-08T12:00:00.000Z" }),
    ];
    const map = new Map<string, MasteryCardInfo>();
    const result = analyzeReviewState(details, T0, map);
    expect(result.count).toBe(2);
    expect(result.reviewCountBuckets.count3).toBe(1);
    expect(result.reviewCountBuckets.count5to9).toBe(1);
  });
});

// ---- checkSchedulerMismatches ----

describe("checkSchedulerMismatches", () => {
  it("reports zero when all match config", () => {
    const details = [card({ flashcardId: "a" }), card({ flashcardId: "b" })];
    expect(checkSchedulerMismatches(details)).toBe(0);
  });

  it("counts mismatches in algorithm, implementation, or parameterSet", () => {
    const details = [
      card({ flashcardId: "a", algorithm: "fsrs-5" }),
      card({ flashcardId: "b" }),
      card({ flashcardId: "c", parameterSet: "unknown" }),
    ];
    expect(checkSchedulerMismatches(details)).toBe(2);
  });
});

// ---- computePercentile ----

describe("computePercentile", () => {
  it("returns 0 for empty array", () => {
    expect(computePercentile([], 50)).toBe(0);
  });

  it("computes percentiles from sorted milliseconds", () => {
    const ms = [3600000, 7200000, 10800000]; // 1h, 2h, 3h
    expect(computePercentile(ms, 50)).toBeCloseTo(2, 1);
    expect(computePercentile(ms, 0)).toBeCloseTo(1, 1);
    expect(computePercentile(ms, 100)).toBeCloseTo(3, 1);
    expect(computePercentile(ms, 90)).toBeCloseTo(3, 1);
  });
});

// ---- Sum helpers ----

describe("sumStateBuckets", () => {
  it("sums multiple StateBuckets", () => {
    expect(
      sumStateBuckets([
        { New: 1, Learning: 2, Review: 0, Relearning: 0 },
        { New: 0, Learning: 1, Review: 3, Relearning: 1 },
      ]),
    ).toEqual({ New: 1, Learning: 3, Review: 3, Relearning: 1 });
  });
});

describe("sumReviewCountBuckets", () => {
  it("sums multiple ReviewCountBuckets", () => {
    expect(
      sumReviewCountBuckets([
        { count1: 1, count2: 0, count3: 0, count4: 0, count5to9: 0, count10Plus: 0 },
        { count1: 2, count2: 1, count3: 0, count4: 0, count5to9: 3, count10Plus: 1 },
      ]),
    ).toEqual({ count1: 3, count2: 1, count3: 0, count4: 0, count5to9: 3, count10Plus: 1 });
  });
});

describe("sumAgeBuckets", () => {
  it("sums multiple AgeBuckets", () => {
    expect(
      sumAgeBuckets([
        { lt1h: 1, h1to24h: 0, d1to7: 0, d7to30: 0, d30to90: 0, gt90d: 0 },
        { lt1h: 0, h1to24h: 2, d1to7: 1, d7to30: 0, d30to90: 0, gt90d: 1 },
      ]),
    ).toEqual({ lt1h: 1, h1to24h: 2, d1to7: 1, d7to30: 0, d30to90: 0, gt90d: 1 });
  });
});

describe("sumMasteryCrossTabs", () => {
  it("sums all cross-tab fields", () => {
    expect(
      sumMasteryCrossTabs([
        {
          untested: 0,
          review: 1,
          learning: 2,
          strong: 0,
          scoreBuckets: {
            sc0to20: 1,
            sc21to40: 2,
            sc41to60: 0,
            sc61to80: 0,
            sc81to100: 0,
            noScore: 0,
          },
        },
        {
          untested: 1,
          review: 0,
          learning: 0,
          strong: 3,
          scoreBuckets: {
            sc0to20: 0,
            sc21to40: 0,
            sc41to60: 1,
            sc61to80: 2,
            sc81to100: 1,
            noScore: 0,
          },
        },
      ]),
    ).toEqual({
      untested: 1,
      review: 1,
      learning: 2,
      strong: 3,
      scoreBuckets: { sc0to20: 1, sc21to40: 2, sc41to60: 1, sc61to80: 2, sc81to100: 1, noScore: 0 },
    });
  });
});

describe("sumLastEventOutcomes", () => {
  it("sums outcome buckets", () => {
    expect(
      sumLastEventOutcomes([
        { again: 1, hard: 0, good: 2, easy: 0, binaryIncorrect: 0, binaryCorrect: 0, unknown: 1 },
        { again: 0, hard: 1, good: 1, easy: 1, binaryIncorrect: 0, binaryCorrect: 0, unknown: 0 },
      ]),
    ).toEqual({
      again: 1,
      hard: 1,
      good: 3,
      easy: 1,
      binaryIncorrect: 0,
      binaryCorrect: 0,
      unknown: 1,
    });
  });
});
