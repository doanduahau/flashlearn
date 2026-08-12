import { describe, expect, it } from "vitest";

import type { MatchCard } from "@/features/match/types/match-types";
import {
  buildMatchBatches,
  buildMatchSession,
  getMatchEligibility,
} from "@/features/match/utils/match-session";
import { normalizeMatchText } from "@/features/match/utils/match-normalize";

function card(id: string, front = id, back = `back-${id}`): MatchCard {
  return { id, front, back };
}

function makeCards(count: number): MatchCard[] {
  return Array.from({ length: count }, (_, i) => card(`card-${i}`, `front-${i}`, `back-${i}`));
}

function fixedRandom(): () => number {
  let n = 0;
  return () => {
    n = (n + 1) % 7;
    return n / 7;
  };
}

describe("getMatchEligibility", () => {
  it("11 eligible -> cannot start", () => {
    const result = getMatchEligibility(11);
    expect(result.canStart).toBe(false);
    expect(result.availableCounts).toEqual([]);
    expect(result.message).toContain("ít nhất 12");
  });

  it("12 eligible -> 12 only", () => {
    const result = getMatchEligibility(12);
    expect(result.canStart).toBe(true);
    expect(result.availableCounts).toEqual([12]);
  });

  it("17 eligible -> 12 only", () => {
    const result = getMatchEligibility(17);
    expect(result.availableCounts).toEqual([12]);
  });

  it("18 eligible -> 12, 18", () => {
    const result = getMatchEligibility(18);
    expect(result.availableCounts).toEqual([12, 18]);
  });

  it("23 eligible -> 12, 18", () => {
    const result = getMatchEligibility(23);
    expect(result.availableCounts).toEqual([12, 18]);
  });

  it("24 eligible -> 12, 18, 24", () => {
    const result = getMatchEligibility(24);
    expect(result.availableCounts).toEqual([12, 18, 24]);
  });

  it("larger set still only offers 12/18/24", () => {
    const result = getMatchEligibility(100);
    expect(result.availableCounts).toEqual([12, 18, 24]);
  });
});

describe("buildMatchBatches", () => {
  it("12 cards -> 2 batches of exactly 6", () => {
    const batches = buildMatchBatches(makeCards(12), fixedRandom());
    expect(batches).toHaveLength(2);
    for (const batch of batches) expect(batch).toHaveLength(6);
  });

  it("18 cards -> 3 batches of exactly 6", () => {
    const batches = buildMatchBatches(makeCards(18), fixedRandom());
    expect(batches).toHaveLength(3);
    for (const batch of batches) expect(batch).toHaveLength(6);
  });

  it("24 cards -> 4 batches of exactly 6", () => {
    const batches = buildMatchBatches(makeCards(24), fixedRandom());
    expect(batches).toHaveLength(4);
    for (const batch of batches) expect(batch).toHaveLength(6);
  });

  it("no flashcard is reused across batches in a session", () => {
    const cards = makeCards(24);
    const batches = buildMatchBatches(cards, fixedRandom());
    const seen = new Set<string>();
    for (const batch of batches) {
      for (const card of batch) {
        expect(seen.has(card.id)).toBe(false);
        seen.add(card.id);
      }
    }
  });
});

describe("buildMatchSession", () => {
  it("12 question count -> 2 batches, 6 fronts + 6 backs each", () => {
    const result = buildMatchSession(makeCards(30), 12, fixedRandom());
    expect(result).not.toBeNull();
    expect(result).toHaveLength(2);
    for (const batch of result ?? []) {
      expect(batch.fronts).toHaveLength(6);
      expect(batch.backs).toHaveLength(6);
    }
  });

  it("18 question count -> 3 batches", () => {
    const result = buildMatchSession(makeCards(30), 18, fixedRandom());
    expect(result).toHaveLength(3);
  });

  it("24 question count -> 4 batches", () => {
    const result = buildMatchSession(makeCards(30), 24, fixedRandom());
    expect(result).toHaveLength(4);
  });

  it("returns null when not enough eligible cards", () => {
    const result = buildMatchSession(makeCards(10), 12, fixedRandom());
    expect(result).toBeNull();
  });

  it("random session selection does not take the first N cards", () => {
    const cards = makeCards(50);
    const result = buildMatchSession(cards, 12, fixedRandom());
    expect(result).not.toBeNull();
    const selected = new Set<string>();
    for (const batch of result ?? []) {
      for (const card of [...batch.fronts, ...batch.backs]) selected.add(card.id);
    }
    expect(selected.size).toBe(12);
  });
});

describe("front/back shuffle independence", () => {
  it("fronts and backs within a batch are independently shuffled", () => {
    const cards = makeCards(24);
    const result = buildMatchSession(cards, 12, fixedRandom());
    expect(result).not.toBeNull();
    const batch = result?.[0];
    expect(batch).toBeTruthy();
    if (!batch) return;
    // Front and back must both be permutations of the same card set.
    const frontIds = batch.fronts.map((c) => c.id).sort();
    const backIds = batch.backs.map((c) => c.id).sort();
    expect(frontIds).toEqual(backIds);
    expect(frontIds).toHaveLength(6);
  });
});

describe("normalizeMatchText", () => {
  it("trims whitespace", () => {
    expect(normalizeMatchText("  CPU  ")).toBe("cpu");
  });

  it("collapses internal whitespace", () => {
    expect(normalizeMatchText("Central   Processing   Unit")).toBe("central processing unit");
  });

  it("lowercases content", () => {
    expect(normalizeMatchText("Central Processing Unit")).toBe("central processing unit");
  });

  it("treats case/space variants as equal", () => {
    expect(normalizeMatchText("CPU")).toBe(normalizeMatchText(" cpu "));
    expect(normalizeMatchText("CPU")).toBe(normalizeMatchText("CPU   "));
  });
});
