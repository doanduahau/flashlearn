import {
  aggregateReviewComparisons,
  compareReviewSources,
  computeReviewComparisonSanity,
  type ReviewComparisonAggregate,
  type ReviewComparisonSanity,
  type ReviewSourceComparison,
} from "./compare-review-sources";

/**
 * Read-only data access needed to run a Mastery-vs-FSRS comparison for the
 * whole production library. Everything here returns card IDs only — no card
 * content, no secrets, no writes.
 */
export type ProductionCompareDataAccess = {
  loadUsersWithHistory(): Promise<string[]>;
  loadMasteryReviewCardIds(userId: string, evaluationTime: string): Promise<string[]>;
  loadFsrsDueCardIds(userId: string, evaluationTime: string): Promise<string[]>;
};

export type PerUserReviewComparison = {
  userId: string;
  label: string;
  comparison: ReviewSourceComparison;
};

export type ProductionComparisonResult = {
  evaluationTime: string;
  perUser: PerUserReviewComparison[];
  aggregate: ReviewComparisonAggregate;
  sanity: ReviewComparisonSanity;
};

/**
 * Compare what current Smart Review would consider review candidates (Mastery
 * V1, library scope) versus what FSRS would consider due right now, for every
 * user with relevant history, all evaluated at one fixed UTC instant.
 */
export async function runProductionComparison(
  data: ProductionCompareDataAccess,
  evaluationTime: string,
): Promise<ProductionComparisonResult> {
  const userIds = await data.loadUsersWithHistory();
  const perUser: PerUserReviewComparison[] = [];

  for (let index = 0; index < userIds.length; index += 1) {
    const userId = userIds[index];
    const [masteryCardIds, fsrsCardIds] = await Promise.all([
      data.loadMasteryReviewCardIds(userId, evaluationTime),
      data.loadFsrsDueCardIds(userId, evaluationTime),
    ]);
    perUser.push({
      userId,
      label: `User ${index + 1}`,
      comparison: compareReviewSources(masteryCardIds, fsrsCardIds),
    });
  }

  const rows = perUser.map((row) => row.comparison);
  return {
    evaluationTime,
    perUser,
    aggregate: aggregateReviewComparisons(rows),
    sanity: computeReviewComparisonSanity(rows),
  };
}
