export type FsrsOnlyCardDetail = {
  flashcardId: string;
  state: number;
  due: string;
  lastReview: string | null;
  scheduledDays: number;
  processedEventCount: number;
  learningSteps: number;
  algorithm: string;
  implementation: string;
  parameterSet: string;
  lastEventFsrsRating: number | null;
  lastEventIsCorrect: boolean | null;
};

export type MasteryCardInfo = {
  flashcardId: string;
  status: "untested" | "review" | "learning" | "strong";
  score: number | null;
};

// ---- Bucket types ----

export type StateBucket = {
  New: number;
  Learning: number;
  Review: number;
  Relearning: number;
};

export type ReviewCountBucket = {
  count1: number;
  count2: number;
  count3: number;
  count4: number;
  count5to9: number;
  count10Plus: number;
};

export type AgeBucket = {
  lt1h: number;
  h1to24h: number;
  d1to7: number;
  d7to30: number;
  d30to90: number;
  gt90d: number;
};

export type OverdueBucket = {
  within1h: number;
  h1to24h: number;
  d1to7: number;
  d7to30: number;
  d30to90: number;
  gt90d: number;
  medianHours: number;
  p90Hours: number;
  maxHours: number;
};

export type LastEventOutcomeBucket = {
  again: number;
  hard: number;
  good: number;
  easy: number;
  binaryIncorrect: number;
  binaryCorrect: number;
  unknown: number;
};

export type MasteryCrossTabulation = {
  untested: number;
  review: number;
  learning: number;
  strong: number;
  scoreBuckets: {
    sc0to20: number;
    sc21to40: number;
    sc41to60: number;
    sc61to80: number;
    sc81to100: number;
    noScore: number;
  };
};

export type OneReviewAnalysis = {
  count: number;
  correctCount: number;
  incorrectCount: number;
  stateNew: number;
  stateLearning: number;
  stateReview: number;
  stateRelearning: number;
  medianDaysSinceReview: number;
};

export type ShortTermLearningEffect = {
  count: number;
  stateLearning: number;
  stateRelearning: number;
};

export type ReviewStateAnalysis = {
  count: number;
  reviewCountBuckets: ReviewCountBucket;
  overdueBuckets: Omit<OverdueBucket, "medianHours" | "p90Hours" | "maxHours"> & {
    medianHours: number;
    p90Hours: number;
    maxHours: number;
  };
  masteryCrossTab: MasteryCrossTabulation;
};

export type PerUserDiagnostic = {
  userId: string;
  label: string;
  fsrsOnlyCount: number;
  stateBuckets: StateBucket;
  reviewCountBuckets: ReviewCountBucket;
  lastReviewAgeBuckets: AgeBucket;
  overdueBuckets: OverdueBucket;
  lastEventOutcome: LastEventOutcomeBucket;
  masteryCrossTab: MasteryCrossTabulation;
  oneReview: OneReviewAnalysis;
  shortTermLearning: ShortTermLearningEffect;
  reviewState: ReviewStateAnalysis;
  schedulerMismatchCount: number;
};

// ---- Constants ----

const MILLISECONDS_PER_HOUR = 3600000;
const MILLISECONDS_PER_DAY = 86400000;

const STATE_NAME: Record<number, keyof StateBucket> = {
  0: "New",
  1: "Learning",
  2: "Review",
  3: "Relearning",
};

// ---- Helpers ----

function parseUtc(value: string): number {
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) return 0;
  return ms;
}

export function computePercentile(sortedMs: readonly number[], percentile: number): number {
  if (sortedMs.length === 0) return 0;
  const index = Math.min(Math.floor((percentile / 100) * sortedMs.length), sortedMs.length - 1);
  return sortedMs[index] / MILLISECONDS_PER_HOUR;
}

function ageHours(endMs: number, startMs: number): number {
  return Math.max(0, endMs - startMs) / MILLISECONDS_PER_HOUR;
}

// ---- Classifiers ----

export function classifyByState(details: readonly FsrsOnlyCardDetail[]): StateBucket {
  const result: StateBucket = { New: 0, Learning: 0, Review: 0, Relearning: 0 };
  for (const d of details) {
    const key = STATE_NAME[d.state] ?? "New";
    result[key] += 1;
  }
  return result;
}

export function classifyByReviewCount(details: readonly FsrsOnlyCardDetail[]): ReviewCountBucket {
  const result: ReviewCountBucket = {
    count1: 0,
    count2: 0,
    count3: 0,
    count4: 0,
    count5to9: 0,
    count10Plus: 0,
  };
  for (const d of details) {
    const c = d.processedEventCount;
    if (c <= 0) continue;
    if (c === 1) result.count1 += 1;
    else if (c === 2) result.count2 += 1;
    else if (c === 3) result.count3 += 1;
    else if (c === 4) result.count4 += 1;
    else if (c <= 9) result.count5to9 += 1;
    else result.count10Plus += 1;
  }
  return result;
}

export function classifyByLastReviewAge(
  details: readonly FsrsOnlyCardDetail[],
  evaluationTime: string,
): AgeBucket {
  const evalMs = parseUtc(evaluationTime);
  const result: AgeBucket = { lt1h: 0, h1to24h: 0, d1to7: 0, d7to30: 0, d30to90: 0, gt90d: 0 };
  for (const d of details) {
    if (!d.lastReview) {
      result.gt90d += 1;
      continue;
    }
    const h = ageHours(evalMs, parseUtc(d.lastReview));
    if (h < 1) result.lt1h += 1;
    else if (h < 24) result.h1to24h += 1;
    else if (h < 168) result.d1to7 += 1;
    else if (h < 720) result.d7to30 += 1;
    else if (h < 2160) result.d30to90 += 1;
    else result.gt90d += 1;
  }
  return result;
}

export function classifyByOverdue(
  details: readonly FsrsOnlyCardDetail[],
  evaluationTime: string,
): Omit<OverdueBucket, "medianHours" | "p90Hours" | "maxHours"> & {
  medianHours: number;
  p90Hours: number;
  maxHours: number;
} {
  const evalMs = parseUtc(evaluationTime);
  const overdueMs: number[] = [];
  const result: Omit<OverdueBucket, "medianHours" | "p90Hours" | "maxHours"> = {
    within1h: 0,
    h1to24h: 0,
    d1to7: 0,
    d7to30: 0,
    d30to90: 0,
    gt90d: 0,
  };

  for (const d of details) {
    const overdueH = ageHours(evalMs, parseUtc(d.due));
    overdueMs.push(overdueH * MILLISECONDS_PER_HOUR);

    if (overdueH < 1) result.within1h += 1;
    else if (overdueH < 24) result.h1to24h += 1;
    else if (overdueH < 168) result.d1to7 += 1;
    else if (overdueH < 720) result.d7to30 += 1;
    else if (overdueH < 2160) result.d30to90 += 1;
    else result.gt90d += 1;
  }

  overdueMs.sort((a, b) => a - b);

  return {
    ...result,
    medianHours: computePercentile(overdueMs, 50),
    p90Hours: computePercentile(overdueMs, 90),
    maxHours: overdueMs.length > 0 ? overdueMs[overdueMs.length - 1] / MILLISECONDS_PER_HOUR : 0,
  };
}

export function classifyLastEventOutcome(
  details: readonly FsrsOnlyCardDetail[],
): LastEventOutcomeBucket {
  const result: LastEventOutcomeBucket = {
    again: 0,
    hard: 0,
    good: 0,
    easy: 0,
    binaryIncorrect: 0,
    binaryCorrect: 0,
    unknown: 0,
  };

  for (const d of details) {
    if (d.lastEventFsrsRating === 1) result.again += 1;
    else if (d.lastEventFsrsRating === 2) result.hard += 1;
    else if (d.lastEventFsrsRating === 3) result.good += 1;
    else if (d.lastEventFsrsRating === 4) result.easy += 1;
    else if (d.lastEventIsCorrect === true) result.binaryCorrect += 1;
    else if (d.lastEventIsCorrect === false) result.binaryIncorrect += 1;
    else result.unknown += 1;
  }

  return result;
}

export function crossTabMastery(
  details: readonly FsrsOnlyCardDetail[],
  masteryMap: ReadonlyMap<string, MasteryCardInfo>,
): MasteryCrossTabulation {
  const result: MasteryCrossTabulation = {
    untested: 0,
    review: 0,
    learning: 0,
    strong: 0,
    scoreBuckets: {
      sc0to20: 0,
      sc21to40: 0,
      sc41to60: 0,
      sc61to80: 0,
      sc81to100: 0,
      noScore: 0,
    },
  };

  for (const d of details) {
    const info = masteryMap.get(d.flashcardId);
    if (!info) {
      result.untested += 1;
      result.scoreBuckets.noScore += 1;
      continue;
    }
    result[info.status] += 1;

    if (info.score === null) {
      result.scoreBuckets.noScore += 1;
    } else if (info.score <= 20) {
      result.scoreBuckets.sc0to20 += 1;
    } else if (info.score <= 40) {
      result.scoreBuckets.sc21to40 += 1;
    } else if (info.score <= 60) {
      result.scoreBuckets.sc41to60 += 1;
    } else if (info.score <= 80) {
      result.scoreBuckets.sc61to80 += 1;
    } else {
      result.scoreBuckets.sc81to100 += 1;
    }
  }

  return result;
}

export function analyzeOneReview(
  details: readonly FsrsOnlyCardDetail[],
  evaluationTime: string,
): OneReviewAnalysis {
  const oneEvent = details.filter((d) => d.processedEventCount === 1);
  const evalMs = parseUtc(evaluationTime);

  let correctCount = 0;
  let incorrectCount = 0;
  const stateBuckets = { New: 0, Learning: 0, Review: 0, Relearning: 0 };
  const daysSinceReview: number[] = [];

  for (const d of oneEvent) {
    if (d.lastEventFsrsRating === 3) correctCount += 1;
    else if (d.lastEventFsrsRating === 1) incorrectCount += 1;

    const key = STATE_NAME[d.state] ?? "New";
    stateBuckets[key] += 1;

    if (d.lastReview) {
      daysSinceReview.push((evalMs - parseUtc(d.lastReview)) / MILLISECONDS_PER_DAY);
    }
  }

  daysSinceReview.sort((a, b) => a - b);

  return {
    count: oneEvent.length,
    correctCount,
    incorrectCount,
    stateNew: stateBuckets.New,
    stateLearning: stateBuckets.Learning,
    stateReview: stateBuckets.Review,
    stateRelearning: stateBuckets.Relearning,
    medianDaysSinceReview:
      daysSinceReview.length > 0
        ? daysSinceReview[Math.floor((daysSinceReview.length - 1) / 2)]
        : 0,
  };
}

export function analyzeShortTermLearning(
  details: readonly FsrsOnlyCardDetail[],
): ShortTermLearningEffect {
  let stateLearning = 0;
  let stateRelearning = 0;

  for (const d of details) {
    if (d.scheduledDays === 0) {
      if (d.state === 1) stateLearning += 1;
      else if (d.state === 3) stateRelearning += 1;
    }
  }

  return {
    count: stateLearning + stateRelearning,
    stateLearning,
    stateRelearning,
  };
}

export function analyzeReviewState(
  details: readonly FsrsOnlyCardDetail[],
  evaluationTime: string,
  masteryMap: ReadonlyMap<string, MasteryCardInfo>,
): ReviewStateAnalysis {
  const reviewCards = details.filter((d) => d.state === 2);
  return {
    count: reviewCards.length,
    reviewCountBuckets: classifyByReviewCount(reviewCards),
    overdueBuckets: classifyByOverdue(reviewCards, evaluationTime),
    masteryCrossTab: crossTabMastery(reviewCards, masteryMap),
  };
}

export function checkSchedulerMismatches(details: readonly FsrsOnlyCardDetail[]): number {
  let mismatches = 0;
  for (const d of details) {
    if (
      d.algorithm !== "fsrs-6" ||
      d.implementation !== "ts-fsrs@5.4.1" ||
      d.parameterSet !== "flashlearn-v1"
    ) {
      mismatches += 1;
    }
  }
  return mismatches;
}

export function sumStateBuckets(buckets: readonly StateBucket[]): StateBucket {
  const result: StateBucket = { New: 0, Learning: 0, Review: 0, Relearning: 0 };
  for (const b of buckets) {
    result.New += b.New;
    result.Learning += b.Learning;
    result.Review += b.Review;
    result.Relearning += b.Relearning;
  }
  return result;
}

export function sumReviewCountBuckets(buckets: readonly ReviewCountBucket[]): ReviewCountBucket {
  const result: ReviewCountBucket = {
    count1: 0,
    count2: 0,
    count3: 0,
    count4: 0,
    count5to9: 0,
    count10Plus: 0,
  };
  for (const b of buckets) {
    result.count1 += b.count1;
    result.count2 += b.count2;
    result.count3 += b.count3;
    result.count4 += b.count4;
    result.count5to9 += b.count5to9;
    result.count10Plus += b.count10Plus;
  }
  return result;
}

export function sumAgeBuckets(buckets: readonly AgeBucket[]): AgeBucket {
  const result: AgeBucket = { lt1h: 0, h1to24h: 0, d1to7: 0, d7to30: 0, d30to90: 0, gt90d: 0 };
  for (const b of buckets) {
    result.lt1h += b.lt1h;
    result.h1to24h += b.h1to24h;
    result.d1to7 += b.d1to7;
    result.d7to30 += b.d7to30;
    result.d30to90 += b.d30to90;
    result.gt90d += b.gt90d;
  }
  return result;
}

export function sumMasteryCrossTabs(
  tabs: readonly MasteryCrossTabulation[],
): MasteryCrossTabulation {
  const result: MasteryCrossTabulation = {
    untested: 0,
    review: 0,
    learning: 0,
    strong: 0,
    scoreBuckets: {
      sc0to20: 0,
      sc21to40: 0,
      sc41to60: 0,
      sc61to80: 0,
      sc81to100: 0,
      noScore: 0,
    },
  };
  for (const t of tabs) {
    result.untested += t.untested;
    result.review += t.review;
    result.learning += t.learning;
    result.strong += t.strong;
    result.scoreBuckets.sc0to20 += t.scoreBuckets.sc0to20;
    result.scoreBuckets.sc21to40 += t.scoreBuckets.sc21to40;
    result.scoreBuckets.sc41to60 += t.scoreBuckets.sc41to60;
    result.scoreBuckets.sc61to80 += t.scoreBuckets.sc61to80;
    result.scoreBuckets.sc81to100 += t.scoreBuckets.sc81to100;
    result.scoreBuckets.noScore += t.scoreBuckets.noScore;
  }
  return result;
}

export function sumLastEventOutcomes(
  buckets: readonly LastEventOutcomeBucket[],
): LastEventOutcomeBucket {
  const result: LastEventOutcomeBucket = {
    again: 0,
    hard: 0,
    good: 0,
    easy: 0,
    binaryIncorrect: 0,
    binaryCorrect: 0,
    unknown: 0,
  };
  for (const b of buckets) {
    result.again += b.again;
    result.hard += b.hard;
    result.good += b.good;
    result.easy += b.easy;
    result.binaryIncorrect += b.binaryIncorrect;
    result.binaryCorrect += b.binaryCorrect;
    result.unknown += b.unknown;
  }
  return result;
}
