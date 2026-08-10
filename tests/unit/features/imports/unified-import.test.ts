import { describe, expect, it } from "vitest";

import { validateDraftCards } from "@/features/imports/utils/validate-draft-cards";
import { sheetToDraftCards } from "@/features/imports/adapters/excel-adapter";

describe("validateDraftCards", () => {
  it("validates normal cards", () => {
    const result = validateDraftCards([
      { front: "Hello", back: "World" },
      { front: "Bonjour", back: "Monde" },
    ]);
    expect(result.valid).toBe(2);
    expect(result.blank).toBe(0);
    expect(result.partial).toBe(0);
    expect(result.duplicate).toBe(0);
    expect(result.cards).toHaveLength(2);
  });

  it("detects blank rows (both empty)", () => {
    const result = validateDraftCards([
      { front: "", back: "" },
      { front: "A", back: "B" },
    ]);
    expect(result.blank).toBe(1);
    expect(result.valid).toBe(1);
  });

  it("detects partial rows (one side empty)", () => {
    const result = validateDraftCards([
      { front: "Only", back: "" },
      { front: "", back: "Only" },
      { front: "OK", back: "OK" },
    ]);
    expect(result.partial).toBe(2);
    expect(result.valid).toBe(1);
  });

  it("deduplicates identical pairs", () => {
    const result = validateDraftCards([
      { front: "A", back: "B" },
      { front: "A", back: "B" },
      { front: "C", back: "D" },
      { front: "C", back: "D" },
    ]);
    expect(result.duplicate).toBe(2);
    expect(result.valid).toBe(2);
    expect(result.cards).toHaveLength(2);
  });

  it("preserves order of first occurrence", () => {
    const result = validateDraftCards([
      { front: "A", back: "B" },
      { front: "C", back: "D" },
      { front: "A", back: "B" },
    ]);
    expect(result.cards[0]?.front).toBe("A");
    expect(result.cards[1]?.front).toBe("C");
  });

  it("tracks sourceRow in output cards", () => {
    const result = validateDraftCards([
      { front: "A", back: "B", sourceRow: 3 },
      { front: "C", back: "D", sourceRow: 7 },
    ]);
    expect(result.cards[0]?.sourceRow).toBe(3);
    expect(result.cards[1]?.sourceRow).toBe(7);
  });

  it("totalInput counts all cards including blanks", () => {
    const result = validateDraftCards([
      { front: "", back: "" },
      { front: "A", back: "B" },
      { front: "", back: "Yes" },
    ]);
    expect(result.totalInput).toBe(3);
  });

  it("trims whitespace in front and back independently", () => {
    const result = validateDraftCards([
      { front: "   Hello   ", back: "  World  " },
      { front: "   Hello   ", back: "  World  " },
    ]);
    expect(result.valid).toBe(1);
    expect(result.duplicate).toBe(1);
  });

  it("empty input produces zero valid", () => {
    const result = validateDraftCards([]);
    expect(result.valid).toBe(0);
    expect(result.cards).toHaveLength(0);
  });
});

describe("sheetToDraftCards (Excel adapter)", () => {
  it("converts raw rows to draft cards with normalize-cell semantics", () => {
    const sheet = {
      rows: [
        ["Front", "Back"],
        ["  Hello  ", "  World  "],
        ["Bonjour\r\n", "Monde"],
      ],
    };
    const cards = sheetToDraftCards(sheet, 0, 1);
    expect(cards).toHaveLength(2);
    expect(cards[0]?.front).toBe("Hello");
    expect(cards[1]?.back).toBe("Monde");
  });

  it("assigns sourceRow starting from 2 (after header)", () => {
    const sheet = {
      rows: [
        ["H1", "H2"],
        ["A", "B"],
        ["C", "D"],
        ["E", "F"],
      ],
    };
    const cards = sheetToDraftCards(sheet, 0, 1);
    expect(cards[0]?.sourceRow).toBe(2);
    expect(cards[1]?.sourceRow).toBe(3);
    expect(cards[2]?.sourceRow).toBe(4);
  });

  it("handles empty cells as empty strings", () => {
    const sheet = {
      rows: [
        ["H1", "H2"],
        ["", ""],
      ],
    };
    const cards = sheetToDraftCards(sheet, 0, 1);
    expect(cards[0]?.front).toBe("");
    expect(cards[0]?.back).toBe("");
  });

  it("handles columns beyond bounds as empty strings", () => {
    const sheet = {
      rows: [["H1"], ["OnlyOne"]],
    };
    const cards = sheetToDraftCards(sheet, 0, 5);
    expect(cards[0]?.back).toBe("");
  });
});
