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
  return Array.from({ length: count }, (_, index) =>
    card(`card-${index}`, `front-${index}`, `back-${index}`),
  );
}

function fixedRandom(): () => number {
  let n = 0;
  return () => {
    n = (n + 1) % 7;
    return n / 7;
  };
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

function expectUnambiguousWithoutReuse(session: NonNullable<ReturnType<typeof buildMatchSession>>) {
  const seen = new Set<string>();
  for (const batch of session) {
    expect(new Set(batch.fronts.map((item) => normalizeMatchText(item.front))).size).toBe(6);
    expect(new Set(batch.backs.map((item) => normalizeMatchText(item.back))).size).toBe(6);
    expect(batch.fronts.map((item) => item.id).sort()).toEqual(
      batch.backs.map((item) => item.id).sort(),
    );
    for (const item of batch.fronts) {
      expect(seen.has(item.id)).toBe(false);
      seen.add(item.id);
    }
  }
}

describe("getMatchEligibility", () => {
  it.each([
    [11, []],
    [12, [12]],
    [17, [12]],
    [18, [12, 18]],
    [23, [12, 18]],
    [24, [12, 18, 24]],
  ] as const)("%i valid cards -> %j", (count, expected) => {
    expect(getMatchEligibility(makeCards(count)).availableCounts).toEqual(expected);
  });

  it("uses constructible capacity rather than raw physical card count", () => {
    const cards = [
      ...Array.from({ length: 18 }, (_, index) =>
        card(`unique-${index}`, `Front ${index}`, `Back ${index}`),
      ),
      ...Array.from({ length: 6 }, (_, index) =>
        card(`duplicate-${index}`, "Shared front", `Duplicate back ${index}`),
      ),
    ];

    expect(cards).toHaveLength(24);
    expect(getMatchEligibility(cards).availableCounts).toEqual([12, 18]);
  });

  it("does not offer 12 when duplicate-heavy cards cannot form two six-pair batches", () => {
    const cards = [
      ...Array.from({ length: 9 }, (_, index) => card(`unique-${index}`, `F${index}`, `B${index}`)),
      ...Array.from({ length: 15 }, (_, index) => card(`shared-${index}`, "Shared", `S${index}`)),
    ];

    expect(getMatchEligibility(cards).availableCounts).not.toContain(12);
  });
});

describe("constructible match batches", () => {
  it("builds exact unambiguous batches without reusing flashcards", () => {
    const session = buildMatchSession(makeCards(24), 24, fixedRandom());
    expect(session).not.toBeNull();
    expect(session).toHaveLength(4);
    expectUnambiguousWithoutReuse(session!);
  });

  it("does not lose valid capacity to the previous greedy skip order", () => {
    const cards: MatchCard[] = [
      ["f7", "b0"],
      ["f2", "b1"],
      ["f5", "b4"],
      ["f0", "b1"],
      ["f6", "b3"],
      ["f6", "b7"],
      ["f0", "b3"],
      ["f7", "b2"],
      ["f1", "b0"],
      ["f2", "b4"],
      ["f4", "b5"],
      ["f4", "b2"],
    ].map(([front, back], index) => card(`adversarial-${index}`, front, back));

    const session = buildMatchSession(cards, 12, () => 0.999999);
    expect(session).not.toBeNull();
    expectUnambiguousWithoutReuse(session!);
  });

  it("returns all constructible batches for the existing utility", () => {
    expect(buildMatchBatches(makeCards(18), fixedRandom())).toHaveLength(3);
  });
});

describe("front/back shuffle independence", () => {
  it("uses distinct derived random streams rather than resetting one permutation for both columns", () => {
    const cards = makeCards(24);
    const alignedPermutations = Array.from({ length: 64 }, (_, seed) => {
      const session = buildMatchSession(cards, 12, mulberry32(seed + 1));
      expect(session).not.toBeNull();
      const firstBatch = session![0];
      return (
        firstBatch.fronts.map((item) => item.id).join(",") ===
        firstBatch.backs.map((item) => item.id).join(",")
      );
    }).filter(Boolean).length;

    // Alignment can happen by chance, but resetting the same seed would align every run.
    expect(alignedPermutations).toBeLessThan(64);
  });
});

describe("normalizeMatchText", () => {
  it("trims, collapses whitespace and lowercases without mutating rendered text", () => {
    expect(normalizeMatchText("  CPU  ")).toBe("cpu");
    expect(normalizeMatchText("CPU")).toBe(normalizeMatchText(" cpu "));
    expect(normalizeMatchText("CPU")).toBe(normalizeMatchText("CPU   "));
    expect(card("unicode", "Tiến trình là gì?", "Người sử dụng dữ liệu").front).toBe(
      "Tiến trình là gì?",
    );
  });
});
