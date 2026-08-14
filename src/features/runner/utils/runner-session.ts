import type { RunnerCard } from "../types/runner-types";

export type RunnerSessionPlan = {
  sessionCardIds: string[];
  selectedCount: number;
};

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function createSeededRunnerRandom(seed: number): () => number {
  return mulberry32(seed);
}

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function uniqueCards(cards: readonly RunnerCard[]): RunnerCard[] {
  const byId = new Map<string, RunnerCard>();
  for (const card of cards) byId.set(card.id, card);
  return [...byId.values()];
}

/**
 * Selects exactly `count` cards for a Runner session. `priority` (uncovered ids,
 * used by the "random" filter) is placed first; the rest keep their seeded
 * shuffle order. Returns null when there are not enough cards.
 */
export function buildRunnerSession(
  cards: readonly RunnerCard[],
  count: number,
  seededRandom: () => number,
  priority?: ReadonlySet<string>,
): RunnerSessionPlan | null {
  if (count > cards.length) return null;

  const shuffled = shuffle(uniqueCards(cards), seededRandom);
  const ordered = priority
    ? shuffled
        .map((card) => ({ card, rank: priority.has(card.id) ? 0 : 1 }))
        .sort((a, b) => a.rank - b.rank)
        .map((entry) => entry.card)
    : shuffled;

  const selected = ordered.slice(0, count);
  return {
    sessionCardIds: selected.map((card) => card.id),
    selectedCount: selected.length,
  };
}
