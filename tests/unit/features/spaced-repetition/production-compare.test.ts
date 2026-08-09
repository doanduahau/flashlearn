import { describe, expect, it } from "vitest";

import {
  ALLOWED_PRODUCTION_PROJECT_REFS as compareAllowlist,
  resolveProductionIdentity as compareResolve,
  validateProductionIdentity as compareValidate,
} from "@/../scripts/fsrs-compare-production";
import {
  ALLOWED_PRODUCTION_PROJECT_REFS as reconcileAllowlist,
  resolveProductionIdentity as reconcileResolve,
  validateProductionIdentity as reconcileValidate,
} from "@/../scripts/fsrs-reconcile-production";
import {
  aggregateReviewComparisons,
  compareReviewSources,
  computeReviewComparisonSanity,
} from "@/features/spaced-repetition/utils/compare-review-sources";
import {
  runProductionComparison,
  type ProductionCompareDataAccess,
} from "@/features/spaced-repetition/utils/run-production-comparison";

const T0 = "2026-08-09T12:00:00.000Z";

function dataAccess(
  overrides: Partial<ProductionCompareDataAccess> = {},
): ProductionCompareDataAccess {
  return {
    loadUsersWithHistory: async () => [],
    loadMasteryReviewCardIds: async () => [],
    loadFsrsDueCardIds: async () => [],
    ...overrides,
  };
}

describe("production identity guard is reused", () => {
  it("compare command uses the exact same guard functions as the reconciliation runner", () => {
    expect(compareResolve).toBe(reconcileResolve);
    expect(compareValidate).toBe(reconcileValidate);
  });

  it("compare command uses the same production allowlist", () => {
    expect(compareAllowlist).toBe(reconcileAllowlist);
    expect(compareAllowlist.has("rtrllrlilupoesikeypt")).toBe(true);
  });

  it("fails closed on a non-allowlisted project ref", () => {
    const identity = {
      url: "https://otherproject.supabase.co",
      projectRef: "otherproject",
      serviceRoleKey: "k",
    };
    expect(() => compareValidate(identity, compareAllowlist)).toThrow(
      /not in the production allowlist/,
    );
  });

  it("resolveProductionIdentity fails closed when credentials are missing", () => {
    expect(() => compareResolve({}, compareAllowlist)).toThrow(
      /FLASHLEARN_PRODUCTION_SUPABASE_URL/,
    );
    expect(() =>
      compareResolve(
        {
          FLASHLEARN_PRODUCTION_SUPABASE_URL: "https://rtrllrlilupoesikeypt.supabase.co",
          FLASHLEARN_PRODUCTION_PROJECT_REF: "rtrllrlilupoesikeypt",
        },
        compareAllowlist,
      ),
    ).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });
});

describe("compareReviewSources", () => {
  it("computes intersection, mastery-only and fsrs-only", () => {
    const result = compareReviewSources(["m1", "m2", "shared"], ["f1", "shared", "f2"]);
    expect(result).toEqual({
      masteryReviewCount: 3,
      fsrsDueCount: 3,
      inBoth: 1,
      masteryOnly: 2,
      fsrsOnly: 2,
    });
  });

  it("handles empty sets", () => {
    expect(compareReviewSources([], [])).toEqual({
      masteryReviewCount: 0,
      fsrsDueCount: 0,
      inBoth: 0,
      masteryOnly: 0,
      fsrsOnly: 0,
    });
  });
});

describe("aggregateReviewComparisons", () => {
  it("sums counts across multiple users", () => {
    const rows = [
      compareReviewSources(["a", "shared"], ["b", "shared"]),
      compareReviewSources(["c"], []),
      compareReviewSources([], ["d", "e"]),
    ];
    const result = aggregateReviewComparisons(rows);
    expect(result).toEqual({
      usersCompared: 3,
      masteryReviewCandidates: 3,
      fsrsDueCandidates: 4,
      inBoth: 1,
      masteryOnly: 2,
      fsrsOnly: 3,
    });
  });

  it("handles zero users", () => {
    expect(aggregateReviewComparisons([])).toEqual({
      usersCompared: 0,
      masteryReviewCandidates: 0,
      fsrsDueCandidates: 0,
      inBoth: 0,
      masteryOnly: 0,
      fsrsOnly: 0,
    });
  });
});

describe("computeReviewComparisonSanity", () => {
  it("classifies Mastery=0/FSRS>0, FSRS=0/Mastery>0, identical and max diff", () => {
    const rows = [
      compareReviewSources([], ["x"]),
      compareReviewSources(["y"], []),
      compareReviewSources(["z", "w"], ["z", "w"]),
      compareReviewSources(["a", "b", "c"], ["a"]),
    ];
    const result = computeReviewComparisonSanity(rows);
    expect(result.usersWithMasteryZeroFsrsPositive).toBe(1);
    expect(result.usersWithFsrsZeroMasteryPositive).toBe(1);
    expect(result.usersWithIdenticalSets).toBe(1);
    expect(result.maxAbsoluteCountDifference).toBe(2);
  });

  it("counts a zero/zero user as identical sets with no difference", () => {
    const rows = [compareReviewSources([], [])];
    const result = computeReviewComparisonSanity(rows);
    expect(result.usersWithMasteryZeroFsrsPositive).toBe(0);
    expect(result.usersWithFsrsZeroMasteryPositive).toBe(0);
    expect(result.usersWithIdenticalSets).toBe(1);
    expect(result.maxAbsoluteCountDifference).toBe(0);
  });
});

describe("runProductionComparison", () => {
  it("aggregates across multiple users and labels them without user IDs", async () => {
    const data = dataAccess({
      loadUsersWithHistory: async () => ["u1", "u2", "u3"],
      loadMasteryReviewCardIds: async (userId) => {
        if (userId === "u1") return ["shared", "m1"];
        if (userId === "u2") return ["m2"];
        return [];
      },
      loadFsrsDueCardIds: async (userId) => {
        if (userId === "u1") return ["shared", "f1"];
        if (userId === "u3") return ["f2"];
        return [];
      },
    });

    const result = await runProductionComparison(data, T0);

    expect(result.evaluationTime).toBe(T0);
    expect(result.perUser.map((row) => row.label)).toEqual(["User 1", "User 2", "User 3"]);
    expect(result.perUser[0].comparison).toEqual({
      masteryReviewCount: 2,
      fsrsDueCount: 2,
      inBoth: 1,
      masteryOnly: 1,
      fsrsOnly: 1,
    });
    expect(result.perUser[1].comparison.masteryOnly).toBe(1);
    expect(result.perUser[1].comparison.fsrsDueCount).toBe(0);
    expect(result.perUser[2].comparison.fsrsOnly).toBe(1);
    expect(result.perUser[2].comparison.masteryReviewCount).toBe(0);

    expect(result.aggregate).toEqual({
      usersCompared: 3,
      masteryReviewCandidates: 3,
      fsrsDueCandidates: 3,
      inBoth: 1,
      masteryOnly: 2,
      fsrsOnly: 2,
    });
  });

  it("propagates one fixed evaluationTime to every data access call", async () => {
    const seenMastery: string[] = [];
    const seenFsrs: string[] = [];

    const data = dataAccess({
      loadUsersWithHistory: async () => ["u1", "u2"],
      loadMasteryReviewCardIds: async (_userId, evaluationTime) => {
        seenMastery.push(evaluationTime);
        return [];
      },
      loadFsrsDueCardIds: async (_userId, evaluationTime) => {
        seenFsrs.push(evaluationTime);
        return [];
      },
    });

    const result = await runProductionComparison(data, T0);

    expect(result.evaluationTime).toBe(T0);
    expect(seenMastery).toEqual([T0, T0]);
    expect(seenFsrs).toEqual([T0, T0]);
  });

  it("handles zero users without error", async () => {
    const result = await runProductionComparison(dataAccess(), T0);
    expect(result.perUser).toEqual([]);
    expect(result.aggregate.usersCompared).toBe(0);
    expect(result.sanity.maxAbsoluteCountDifference).toBe(0);
  });
});
