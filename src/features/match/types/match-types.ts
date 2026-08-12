export type MatchCard = {
  id: string;
  front: string;
  back: string;
};

export type MatchQuestionCount = 12 | 18 | 24;

export const MATCH_PAIR_COUNT = 6 as const;

export const MATCH_QUESTION_COUNTS: readonly MatchQuestionCount[] = [12, 18, 24];

export type MatchPair = {
  frontCardId: string;
  backCardId: string;
  front: string;
  back: string;
};

export type MatchBatch = {
  fronts: MatchCard[];
  backs: MatchCard[];
};

export type MatchSessionPlan = {
  batches: MatchBatch[];
  selectedCount: number;
  eligibleCount: number;
};

export type StartedMatchSession = MatchSessionPlan & {
  coverageSessionId: string;
};
