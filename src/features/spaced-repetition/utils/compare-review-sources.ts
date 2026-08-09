export type ReviewSourceComparison = {
  masteryReviewCount: number;
  fsrsDueCount: number;
  inBoth: number;
  masteryOnly: number;
  fsrsOnly: number;
};

export function compareReviewSources(
  masteryCardIds: readonly string[],
  fsrsCardIds: readonly string[],
): ReviewSourceComparison {
  const mastery = new Set(masteryCardIds);
  const fsrs = new Set(fsrsCardIds);

  let inBoth = 0;
  let masteryOnly = 0;
  let fsrsOnly = 0;

  for (const id of mastery) {
    if (fsrs.has(id)) inBoth += 1;
    else masteryOnly += 1;
  }
  for (const id of fsrs) {
    if (!mastery.has(id)) fsrsOnly += 1;
  }

  return {
    masteryReviewCount: mastery.size,
    fsrsDueCount: fsrs.size,
    inBoth,
    masteryOnly,
    fsrsOnly,
  };
}

export type ReviewComparisonAggregate = {
  usersCompared: number;
  masteryReviewCandidates: number;
  fsrsDueCandidates: number;
  inBoth: number;
  masteryOnly: number;
  fsrsOnly: number;
};

export function aggregateReviewComparisons(
  rows: readonly ReviewSourceComparison[],
): ReviewComparisonAggregate {
  let masteryReviewCandidates = 0;
  let fsrsDueCandidates = 0;
  let inBoth = 0;
  let masteryOnly = 0;
  let fsrsOnly = 0;

  for (const row of rows) {
    masteryReviewCandidates += row.masteryReviewCount;
    fsrsDueCandidates += row.fsrsDueCount;
    inBoth += row.inBoth;
    masteryOnly += row.masteryOnly;
    fsrsOnly += row.fsrsOnly;
  }

  return {
    usersCompared: rows.length,
    masteryReviewCandidates,
    fsrsDueCandidates,
    inBoth,
    masteryOnly,
    fsrsOnly,
  };
}

export type ReviewComparisonSanity = {
  usersWithMasteryZeroFsrsPositive: number;
  usersWithFsrsZeroMasteryPositive: number;
  usersWithIdenticalSets: number;
  maxAbsoluteCountDifference: number;
};

export function computeReviewComparisonSanity(
  rows: readonly ReviewSourceComparison[],
): ReviewComparisonSanity {
  let usersWithMasteryZeroFsrsPositive = 0;
  let usersWithFsrsZeroMasteryPositive = 0;
  let usersWithIdenticalSets = 0;
  let maxAbsoluteCountDifference = 0;

  for (const row of rows) {
    if (row.masteryReviewCount === 0 && row.fsrsDueCount > 0) {
      usersWithMasteryZeroFsrsPositive += 1;
    }
    if (row.fsrsDueCount === 0 && row.masteryReviewCount > 0) {
      usersWithFsrsZeroMasteryPositive += 1;
    }
    if (row.inBoth === row.masteryReviewCount && row.inBoth === row.fsrsDueCount) {
      usersWithIdenticalSets += 1;
    }
    const absoluteDifference = Math.abs(row.masteryReviewCount - row.fsrsDueCount);
    if (absoluteDifference > maxAbsoluteCountDifference) {
      maxAbsoluteCountDifference = absoluteDifference;
    }
  }

  return {
    usersWithMasteryZeroFsrsPositive,
    usersWithFsrsZeroMasteryPositive,
    usersWithIdenticalSets,
    maxAbsoluteCountDifference,
  };
}
