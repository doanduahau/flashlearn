import { MATCH_PAIR_COUNT, type MatchBatch, type MatchCard } from "../types/match-types";
import { normalizeMatchText } from "./match-normalize";

export type MatchEligibility = {
  availableCounts: number[];
  canStart: boolean;
  message: string | null;
};

type BatchKeys = { fronts: Set<string>; backs: Set<string>; cards: MatchCard[] };

type FlowEdge = {
  to: number;
  reverse: number;
  capacity: number;
  cost: number;
  card?: MatchCard;
};

const FRONT_STREAM_SALT = 0x9e3779b9;
const BACK_STREAM_SALT = 0x85ebca6b;

export function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

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

export function createSeededMatchRandom(seed: number): () => number {
  return mulberry32(seed);
}

function derivedRandom(random: () => number, salt: number): () => number {
  const seed = Math.floor(random() * 2 ** 32) >>> 0;
  return mulberry32((seed ^ salt) >>> 0);
}

function uniqueCards(cards: readonly MatchCard[]): MatchCard[] {
  const byId = new Map<string, MatchCard>();
  for (const card of cards) byId.set(card.id, card);
  return [...byId.values()];
}

function addEdge(
  graph: FlowEdge[][],
  from: number,
  to: number,
  capacity: number,
  cost = 0,
  card?: MatchCard,
): FlowEdge {
  const forward: FlowEdge = { to, reverse: graph[to].length, capacity, cost, card };
  const backward: FlowEdge = { to: from, reverse: graph[from].length, capacity: 0, cost: -cost };
  graph[from].push(forward);
  graph[to].push(backward);
  return forward;
}

/**
 * Selects exactly `batchCount * 6` cards while each normalized Front and Back
 * appears at most once per future batch. This is a deterministic bipartite
 * b-matching (front/back capacity = number of batches), not a greedy pass.
 */
function selectCardsForBatches(
  cards: readonly MatchCard[],
  batchCount: number,
  random?: () => number,
  priorityIds?: ReadonlySet<string>,
): MatchCard[] | null {
  const target = batchCount * MATCH_PAIR_COUNT;
  const ordered = random
    ? shuffle(uniqueCards(cards), random)
    : uniqueCards(cards).sort((a, b) => a.id.localeCompare(b.id));
  if (ordered.length < target) return null;

  const frontKeys = [...new Set(ordered.map((card) => normalizeMatchText(card.front)))];
  const backKeys = [...new Set(ordered.map((card) => normalizeMatchText(card.back)))];
  const source = 0;
  const firstFront = 1;
  const firstBack = firstFront + frontKeys.length;
  const sink = firstBack + backKeys.length;
  const graph = Array.from({ length: sink + 1 }, () => [] as FlowEdge[]);
  const frontNode = new Map(frontKeys.map((key, index) => [key, firstFront + index]));
  const backNode = new Map(backKeys.map((key, index) => [key, firstBack + index]));

  for (const key of frontKeys) addEdge(graph, source, frontNode.get(key)!, batchCount);
  for (const key of backKeys) addEdge(graph, backNode.get(key)!, sink, batchCount);

  const cardEdges = ordered.map((card) =>
    addEdge(
      graph,
      frontNode.get(normalizeMatchText(card.front))!,
      backNode.get(normalizeMatchText(card.back))!,
      1,
      priorityIds?.has(card.id) ? -1 : 0,
      card,
    ),
  );

  let flow = 0;
  while (flow < target) {
    const parent = Array.from({ length: graph.length }, () => -1);
    const parentEdge = Array.from({ length: graph.length }, () => -1);
    const distance = Array.from({ length: graph.length }, () => Number.POSITIVE_INFINITY);
    distance[source] = 0;
    for (let pass = 0; pass < graph.length - 1; pass += 1) {
      let changed = false;
      for (let node = 0; node < graph.length; node += 1) {
        if (!Number.isFinite(distance[node])) continue;
        for (let edgeIndex = 0; edgeIndex < graph[node].length; edgeIndex += 1) {
          const edge = graph[node][edgeIndex];
          if (edge.capacity <= 0 || distance[edge.to] <= distance[node] + edge.cost) continue;
          distance[edge.to] = distance[node] + edge.cost;
          parent[edge.to] = node;
          parentEdge[edge.to] = edgeIndex;
          changed = true;
        }
      }
      if (!changed) break;
    }
    if (!Number.isFinite(distance[sink])) break;

    for (let node = sink; node !== source; node = parent[node]) {
      const edge = graph[parent[node]][parentEdge[node]];
      edge.capacity -= 1;
      graph[node][edge.reverse].capacity += 1;
    }
    flow += 1;
  }

  if (flow < target) return null;
  return cardEdges.flatMap((edge) => (edge.capacity === 0 && edge.card ? [edge.card] : []));
}

/**
 * A selected b-matching has degree <= batchCount at both endpoints. Assign it
 * to equal six-card batches with deterministic backtracking, so availability
 * is a property of the card set rather than the previous greedy order.
 */
function partitionSelectedCards(
  selectedCards: readonly MatchCard[],
  batchCount: number,
): MatchCard[][] | null {
  const frontDegrees = new Map<string, number>();
  const backDegrees = new Map<string, number>();
  for (const card of selectedCards) {
    const front = normalizeMatchText(card.front);
    const back = normalizeMatchText(card.back);
    frontDegrees.set(front, (frontDegrees.get(front) ?? 0) + 1);
    backDegrees.set(back, (backDegrees.get(back) ?? 0) + 1);
  }

  const ordered = [...selectedCards].sort((a, b) => {
    const aDegree = Math.max(
      frontDegrees.get(normalizeMatchText(a.front)) ?? 0,
      backDegrees.get(normalizeMatchText(a.back)) ?? 0,
    );
    const bDegree = Math.max(
      frontDegrees.get(normalizeMatchText(b.front)) ?? 0,
      backDegrees.get(normalizeMatchText(b.back)) ?? 0,
    );
    return bDegree - aDegree || a.id.localeCompare(b.id);
  });
  const batches: BatchKeys[] = Array.from({ length: batchCount }, () => ({
    fronts: new Set(),
    backs: new Set(),
    cards: [],
  }));

  function assign(index: number): boolean {
    if (index === ordered.length)
      return batches.every((batch) => batch.cards.length === MATCH_PAIR_COUNT);
    const card = ordered[index];
    const front = normalizeMatchText(card.front);
    const back = normalizeMatchText(card.back);
    const candidates = batches
      .map((batch, batchIndex) => ({ batch, batchIndex }))
      .filter(
        ({ batch }) =>
          batch.cards.length < MATCH_PAIR_COUNT &&
          !batch.fronts.has(front) &&
          !batch.backs.has(back),
      )
      .sort((a, b) => a.batch.cards.length - b.batch.cards.length || a.batchIndex - b.batchIndex);

    for (const { batch } of candidates) {
      batch.cards.push(card);
      batch.fronts.add(front);
      batch.backs.add(back);
      if (assign(index + 1)) return true;
      batch.cards.pop();
      batch.fronts.delete(front);
      batch.backs.delete(back);
    }
    return false;
  }

  return assign(0) ? batches.map((batch) => batch.cards) : null;
}

function buildBatchesForCount(
  cards: readonly MatchCard[],
  batchCount: number,
  random?: () => number,
  priorityIds?: ReadonlySet<string>,
): MatchCard[][] | null {
  const selected = selectCardsForBatches(cards, batchCount, random, priorityIds);
  return selected ? partitionSelectedCards(selected, batchCount) : null;
}

export function getMatchEligibility(cards: readonly MatchCard[]): MatchEligibility {
  const availableCounts = ([12, 18, 24] as const).filter((count) =>
    Boolean(buildBatchesForCount(cards, count / MATCH_PAIR_COUNT)),
  );
  if (availableCounts.length === 0) {
    return {
      availableCounts: [],
      canStart: false,
      message: "Match yêu cầu ít nhất 12 thẻ có thể ghép rõ ràng.",
    };
  }
  return { availableCounts: [...availableCounts], canStart: true, message: null };
}

export function buildMatchBatches(
  cards: readonly MatchCard[],
  random: () => number,
): MatchCard[][] {
  for (const batchCount of [4, 3, 2, 1]) {
    const batches = buildBatchesForCount(cards, batchCount, random);
    if (batches) return batches;
  }
  return [];
}

export function buildMatchSession(
  eligibleCards: readonly MatchCard[],
  questionCount: number,
  random: () => number,
  priorityIds?: ReadonlySet<string>,
): MatchBatch[] | null {
  const batchCount = questionCount / MATCH_PAIR_COUNT;
  if (!Number.isInteger(batchCount)) return null;
  const batches = buildBatchesForCount(eligibleCards, batchCount, random, priorityIds);
  if (!batches) return null;

  return batches.map((batch) => ({
    fronts: shuffle(batch, derivedRandom(random, FRONT_STREAM_SALT)),
    backs: shuffle(batch, derivedRandom(random, BACK_STREAM_SALT)),
  }));
}
