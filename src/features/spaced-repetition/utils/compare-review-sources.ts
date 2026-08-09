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
