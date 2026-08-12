import { normalizeContentText } from "@/lib/normalize-content";
import {
  MEMORY_PAIR_COUNT,
  type MemoryBatch,
  type MemoryCard,
  type MemoryTile,
} from "../types/memory-types";

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function uniqueById(cards: readonly MemoryCard[]): MemoryCard[] {
  const byId = new Map<string, MemoryCard>();
  for (const card of cards) byId.set(card.id, card);
  return [...byId.values()];
}

type BatchState = { values: Set<string>; cards: MemoryCard[] };

/**
 * A card is Memory-eligible only when its own Front and Back are distinct after
 * canonical normalization. A self-colliding card would place two identical
 * tiles into the same batch, which the combined-uniqueness rule forbids.
 */
export function isMemoryEligibleCard(card: MemoryCard): boolean {
  return normalizeContentText(card.front) !== normalizeContentText(card.back);
}

/**
 * Selects `batchCount * 6` cards and partitions them into six-card batches
 * whose combined twelve content values are all distinct after normalization.
 *
 * Uncovered cards are tried first (coverage priority), then covered cards are
 * ordered by value rarity to help feasibility. Selection + partition share one
 * bounded backtracking pass, so availability is a property of the card set
 * rather than a lucky shuffle order.
 */
function selectAndPartition(
  eligible: readonly MemoryCard[],
  batchCount: number,
  random: () => number,
  priorityIds?: ReadonlySet<string>,
): MemoryCard[][] | null {
  const target = batchCount * MEMORY_PAIR_COUNT;
  if (eligible.length < target) return null;

  const uncovered = eligible.filter((card) => priorityIds?.has(card.id));
  const covered = eligible.filter((card) => !priorityIds?.has(card.id));

  const valueFrequency = new Map<string, number>();
  for (const card of eligible) {
    for (const key of [normalizeContentText(card.front), normalizeContentText(card.back)]) {
      valueFrequency.set(key, (valueFrequency.get(key) ?? 0) + 1);
    }
  }
  const rarity = (card: MemoryCard) =>
    Math.min(
      valueFrequency.get(normalizeContentText(card.front)) ?? 0,
      valueFrequency.get(normalizeContentText(card.back)) ?? 0,
    );

  const ordered = [
    ...shuffle(uncovered, random),
    ...shuffle(covered, random).sort((a, b) => rarity(a) - rarity(b) || a.id.localeCompare(b.id)),
  ];

  const batches: BatchState[] = Array.from({ length: batchCount }, () => ({
    values: new Set(),
    cards: [],
  }));

  let nodes = 0;
  const NODE_LIMIT = 200_000;

  function assign(cardIndex: number): boolean {
    if (batches.every((batch) => batch.cards.length === MEMORY_PAIR_COUNT)) return true;
    if (cardIndex >= ordered.length) return false;
    nodes += 1;
    if (nodes > NODE_LIMIT) return false;

    const card = ordered[cardIndex];
    const front = normalizeContentText(card.front);
    const back = normalizeContentText(card.back);

    const candidates = batches
      .map((batch, index) => ({ batch, index }))
      .filter(
        ({ batch }) =>
          batch.cards.length < MEMORY_PAIR_COUNT &&
          !batch.values.has(front) &&
          !batch.values.has(back),
      )
      .sort((a, b) => a.batch.cards.length - b.batch.cards.length || a.index - b.index);

    for (const { batch } of candidates) {
      batch.cards.push(card);
      batch.values.add(front);
      batch.values.add(back);
      if (assign(cardIndex + 1)) return true;
      batch.cards.pop();
      batch.values.delete(front);
      batch.values.delete(back);
    }

    return assign(cardIndex + 1);
  }

  if (!assign(0)) return null;
  return batches.map((batch) => batch.cards);
}

function tilesForBatch(cards: readonly MemoryCard[], random: () => number): MemoryTile[] {
  const tiles: MemoryTile[] = [];
  for (const card of cards) {
    tiles.push({ key: `${card.id}:front`, cardId: card.id, side: "front", content: card.front });
    tiles.push({ key: `${card.id}:back`, cardId: card.id, side: "back", content: card.back });
  }
  return shuffle(tiles, random);
}

export function buildMemoryBatches(
  cards: readonly MemoryCard[],
  batchCount: number,
  random: () => number,
  priorityIds?: ReadonlySet<string>,
): MemoryBatch[] | null {
  const eligible = uniqueById(cards).filter(isMemoryEligibleCard);
  const partitions = selectAndPartition(eligible, batchCount, random, priorityIds);
  if (!partitions) return null;
  return partitions.map((batch) => ({ tiles: tilesForBatch(batch, random) }));
}

export function getMemoryEligibility(cards: readonly MemoryCard[]): {
  availableCounts: number[];
  message: string | null;
} {
  const eligible = uniqueById(cards).filter(isMemoryEligibleCard);
  const availableCounts = ([12, 18, 24] as const).filter((count) =>
    Boolean(buildMemoryBatches(eligible, count / MEMORY_PAIR_COUNT, () => 0.5)),
  );
  if (availableCounts.length === 0) {
    return {
      availableCounts: [],
      message: "Memory yêu cầu ít nhất 12 thẻ có thể ghép rõ ràng.",
    };
  }
  return { availableCounts: [...availableCounts], message: null };
}

export function buildMemorySession(
  eligibleCards: readonly MemoryCard[],
  questionCount: number,
  random: () => number,
  priorityIds?: ReadonlySet<string>,
): MemoryBatch[] | null {
  const batchCount = questionCount / MEMORY_PAIR_COUNT;
  if (!Number.isInteger(batchCount)) return null;
  return buildMemoryBatches(eligibleCards, batchCount, random, priorityIds);
}
