import type { FlashcardMastery } from "@/features/mastery/types/mastery-types";

export type MasteryAggregate = {
  total: number;
  untested: number;
  review: number;
  learning: number;
  strong: number;
};

export const EMPTY_MASTERY_AGGREGATE: MasteryAggregate = {
  total: 0,
  untested: 0,
  review: 0,
  learning: 0,
  strong: 0,
};

export function aggregateMastery(
  masteries: readonly Pick<FlashcardMastery, "status">[],
): MasteryAggregate {
  const aggregate: MasteryAggregate = { ...EMPTY_MASTERY_AGGREGATE };
  for (const mastery of masteries) {
    aggregate[mastery.status] += 1;
  }
  aggregate.total = aggregate.untested + aggregate.review + aggregate.learning + aggregate.strong;
  return aggregate;
}
