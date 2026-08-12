import { MATCH_PAIR_COUNT, type MatchBatch, type MatchCard } from "../types/match-types";
import { uniqueBackKeys, uniqueFrontKeys } from "./match-normalize";

export type MatchEligibility = {
  availableCounts: number[];
  canStart: boolean;
  message: string | null;
};

export function getMatchEligibility(eligibleCount: number): MatchEligibility {
  if (eligibleCount < 12) {
    return {
      availableCounts: [],
      canStart: false,
      message: "Match yêu cầu ít nhất 12 thẻ hợp lệ.",
    };
  }
  if (eligibleCount < 18) {
    return { availableCounts: [12], canStart: true, message: null };
  }
  if (eligibleCount < 24) {
    return { availableCounts: [12, 18], canStart: true, message: null };
  }
  return { availableCounts: [12, 18, 24], canStart: true, message: null };
}

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function batchIsUnambiguous(fronts: MatchCard[], backs: MatchCard[]): boolean {
  const frontKeys = uniqueFrontKeys(fronts);
  const backKeys = uniqueBackKeys(backs);
  return frontKeys.size === fronts.length && backKeys.size === backs.length;
}

/**
 * Build as many valid unambiguous six-card batches as possible from the
 * candidate cards without reusing any card.
 *
 * Each batch is filled one card at a time; a candidate is skipped when adding
 * it would introduce a duplicate normalized Front or Back within that batch.
 */
export function buildMatchBatches(
  cards: readonly MatchCard[],
  random: () => number,
): MatchCard[][] {
  const candidates = shuffle(cards, random);
  const batches: MatchCard[][] = [];
  let current: MatchCard[] = [];

  for (const card of candidates) {
    const trial = [...current, card];
    if (batchIsUnambiguous(trial, trial)) {
      current = trial;
      if (current.length === MATCH_PAIR_COUNT) {
        batches.push(current);
        current = [];
      }
    }
  }

  return batches;
}

export function buildMatchSession(
  eligibleCards: readonly MatchCard[],
  questionCount: number,
  random: () => number,
): MatchBatch[] | null {
  const batches = buildMatchBatches(eligibleCards, random);
  const needed = questionCount / MATCH_PAIR_COUNT;
  if (batches.length < needed) return null;
  return batches.slice(0, needed).map((batch) => ({
    fronts: shuffle(batch, random),
    backs: shuffle(batch, random),
  }));
}
