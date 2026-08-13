import { describe, expect, it } from "vitest";

import type { MemoryCard } from "@/features/memory/types/memory-types";
import {
  buildMemoryBatches,
  buildMemorySession,
  getMemoryEligibility,
  isMemoryEligibleCard,
} from "@/features/memory/utils/memory-session";

function card(id: string, front = id, back = `back-${id}`): MemoryCard {
  return { id, front, back };
}

function makeCards(count: number): MemoryCard[] {
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

describe("buildMemorySession batch construction", () => {
  it("12 cards -> 2 batches of 6 cards / 12 tiles", () => {
    const result = buildMemorySession(makeCards(12), 12, fixedRandom());
    expect(result).not.toBeNull();
    expect(result).toHaveLength(2);
    for (const batch of result ?? []) {
      expect(batch.tiles).toHaveLength(12);
    }
  });

  it("18 cards -> 3 batches", () => {
    const result = buildMemorySession(makeCards(18), 18, fixedRandom());
    expect(result).toHaveLength(3);
  });

  it("24 cards -> 4 batches", () => {
    const result = buildMemorySession(makeCards(24), 24, fixedRandom());
    expect(result).toHaveLength(4);
  });

  it("no flashcard is reused across the session", () => {
    const result = buildMemorySession(makeCards(24), 24, fixedRandom());
    const cardToBatch = new Map<string, number>();
    for (let batchIndex = 0; batchIndex < (result ?? []).length; batchIndex += 1) {
      for (const tile of result?.[batchIndex].tiles ?? []) {
        if (cardToBatch.has(tile.cardId)) {
          expect(cardToBatch.get(tile.cardId)).toBe(batchIndex);
        } else {
          cardToBatch.set(tile.cardId, batchIndex);
        }
      }
    }
    expect(cardToBatch.size).toBe(24);
  });
});

describe("combined twelve-content uniqueness", () => {
  it("front and back of another card cannot share a normalized value", () => {
    const cards: MemoryCard[] = [card("1", "CPU", "RAM"), card("2", " cpu ", "GPU")];
    // "CPU" (card 1 front) collides with "cpu" (card 2 front) after normalization.
    const result = buildMemoryBatches(cards, 1, fixedRandom());
    expect(result).toBeNull();
  });

  it("whitespace-collapsed duplicate is treated as a collision", () => {
    const cards: MemoryCard[] = [
      card("1", "Central  Processing  Unit", "RAM"),
      card("2", "central processing unit", "GPU"),
    ];
    const result = buildMemoryBatches(cards, 1, fixedRandom());
    expect(result).toBeNull();
  });

  it("case-insensitive duplicate is treated as a collision", () => {
    const cards: MemoryCard[] = [card("1", "CPU", "RAM"), card("2", "Cpu", "GPU")];
    const result = buildMemoryBatches(cards, 1, fixedRandom());
    expect(result).toBeNull();
  });

  it("distinct normalized values form a valid batch", () => {
    const result = buildMemorySession(makeCards(6), 12, fixedRandom());
    expect(result).toBeNull();
    const withTwelve = buildMemorySession(makeCards(12), 12, fixedRandom());
    expect(withTwelve).toHaveLength(2);
  });
});

describe("memory card eligibility", () => {
  it("a card whose front and back normalize equally is ineligible", () => {
    expect(isMemoryEligibleCard(card("1", "CPU", " cpu "))).toBe(false);
  });

  it("a card with distinct front and back is eligible", () => {
    expect(isMemoryEligibleCard(card("1", "CPU", "RAM"))).toBe(true);
  });

  it("self-colliding cards are excluded from availability", () => {
    const cards: MemoryCard[] = [
      card("1", "CPU", " cpu "), // self-colliding -> ineligible
      ...makeCards(12),
    ];
    const eligibility = getMemoryEligibility(cards);
    expect(eligibility.availableCounts).toContain(12);
  });
});

describe("getMemoryEligibility availability", () => {
  it("fewer than 12 eligible cards cannot start", () => {
    const eligibility = getMemoryEligibility(makeCards(11));
    expect(eligibility.availableCounts).toEqual([]);
    expect(eligibility.message).toContain("ít nhất 12");
  });

  it("12 eligible cards offer 12 only", () => {
    expect(getMemoryEligibility(makeCards(12)).availableCounts).toEqual([12]);
  });

  it("18 eligible cards offer 12 and 18", () => {
    expect(getMemoryEligibility(makeCards(18)).availableCounts).toEqual([12, 18]);
  });

  it("24 eligible cards offer 12, 18, 24", () => {
    expect(getMemoryEligibility(makeCards(24)).availableCounts).toEqual([12, 18, 24]);
  });

  it("a large set still offers only 12/18/24", () => {
    expect(getMemoryEligibility(makeCards(100)).availableCounts).toEqual([12, 18, 24]);
  });
});

describe("coverage priority", () => {
  it("prioritizes uncovered cards while still producing valid batches", () => {
    const cards = makeCards(24);
    const priority = new Set(cards.slice(0, 6).map((card) => card.id));
    const result = buildMemorySession(cards, 12, fixedRandom(), priority);
    expect(result).not.toBeNull();
    expect(result).toHaveLength(2);
  });

  it("selects all three compatible uncovered cards for the exact 15-card / 12-session case", () => {
    const cards = makeCards(15);
    const uncoveredIds = new Set(cards.slice(12).map((card) => card.id));
    const result = buildMemorySession(cards, 12, fixedRandom(), uncoveredIds);
    const selectedIds = new Set(result?.flatMap((batch) => batch.tiles.map((tile) => tile.cardId)));

    expect(selectedIds).toHaveLength(12);
    expect([...uncoveredIds].every((id) => selectedIds.has(id))).toBe(true);
    expect([...selectedIds].filter((id) => !uncoveredIds.has(id))).toHaveLength(9);
  });
});
