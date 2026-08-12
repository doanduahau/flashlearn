import { describe, expect, it } from "vitest";

import type { MatchCard } from "@/features/match/types/match-types";
import { buildMatchBatches, buildMatchSession } from "@/features/match/utils/match-session";
import { uniqueBackKeys, uniqueFrontKeys } from "@/features/match/utils/match-normalize";

function fixedRandom(): () => number {
  let n = 0;
  return () => {
    n = (n + 1) % 5;
    return n / 5;
  };
}

describe("match duplicate ambiguity", () => {
  it("a batch never contains duplicate normalized Front values", () => {
    const cards: MatchCard[] = [
      { id: "1", front: "CPU", back: "B1" },
      { id: "2", front: " cpu ", back: "B2" },
      { id: "3", front: "CPU   ", back: "B3" },
      { id: "4", front: "RAM", back: "B4" },
      { id: "5", front: "GPU", back: "B5" },
      { id: "6", front: "SSD", back: "B6" },
      { id: "7", front: "HDD", back: "B7" },
      { id: "8", front: "USB", back: "B8" },
      { id: "9", front: "ROM", back: "B9" },
      { id: "10", front: "DDR", back: "B10" },
      { id: "11", front: "PCI", back: "B11" },
      { id: "12", front: "SATA", back: "B12" },
    ];
    const batches = buildMatchBatches(cards, fixedRandom());
    for (const batch of batches) {
      expect(uniqueFrontKeys(batch).size).toBe(batch.length);
    }
  });

  it("a batch never contains duplicate normalized Back values", () => {
    const cards: MatchCard[] = [
      { id: "1", front: "F1", back: "Central   Processing Unit" },
      { id: "2", front: "F2", back: "central processing unit" },
      { id: "3", front: "F3", back: "Central Processing Unit " },
      { id: "4", front: "F4", back: "Random Access Memory" },
      { id: "5", front: "F5", back: "Graphics Unit" },
      { id: "6", front: "F6", back: "Solid State Drive" },
      { id: "7", front: "F7", back: "Hard Disk Drive" },
      { id: "8", front: "F8", back: "Universal Serial Bus" },
      { id: "9", front: "F9", back: "Read Only Memory" },
      { id: "10", front: "F10", back: "Double Data Rate" },
      { id: "11", front: "F11", back: "Peripheral Interconnect" },
      { id: "12", front: "F12", back: "Serial ATA" },
    ];
    const batches = buildMatchBatches(cards, fixedRandom());
    for (const batch of batches) {
      expect(uniqueBackKeys(batch).size).toBe(batch.length);
    }
  });

  it("duplicate-heavy source still produces valid unambiguous batches of 6", () => {
    // 18 cards: 6 unique fronts, then 12 more that duplicate normalized fronts.
    const cards: MatchCard[] = [];
    for (let i = 0; i < 6; i++) cards.push({ id: `u${i}`, front: `Front ${i}`, back: `Back ${i}` });
    for (let i = 6; i < 18; i++)
      cards.push({ id: `d${i}`, front: `Front ${i % 6}`, back: `Back ${i % 6}` });
    const batches = buildMatchBatches(cards, fixedRandom());
    for (const batch of batches) {
      expect(uniqueFrontKeys(batch).size).toBe(batch.length);
      expect(uniqueBackKeys(batch).size).toBe(batch.length);
    }
  });

  it("session batches never reuse a flashcard within the same column and remain unambiguous", () => {
    const cards: MatchCard[] = Array.from({ length: 24 }, (_, i) => ({
      id: `c${i}`,
      front: `Q${i}`,
      back: `A${i}`,
    }));
    const session = buildMatchSession(cards, 12, fixedRandom());
    expect(session).not.toBeNull();
    const seenFronts = new Set<string>();
    const seenBacks = new Set<string>();
    for (const batch of session ?? []) {
      expect(uniqueFrontKeys(batch.fronts).size).toBe(batch.fronts.length);
      expect(uniqueBackKeys(batch.backs).size).toBe(batch.backs.length);
      for (const c of batch.fronts) {
        expect(seenFronts.has(c.id)).toBe(false);
        seenFronts.add(c.id);
      }
      for (const c of batch.backs) {
        expect(seenBacks.has(c.id)).toBe(false);
        seenBacks.add(c.id);
      }
      // The same card legitimately appears once as a front and once as a back.
      const frontIds = batch.fronts.map((c) => c.id).sort();
      const backIds = batch.backs.map((c) => c.id).sort();
      expect(frontIds).toEqual(backIds);
    }
  });
});
