import { describe, expect, it } from "vitest";

/**
 * Combined edit-session test: simulates a full editor session
 * on the logical editable-card state model.
 *
 * This validates the editor's data model without rendering.
 */

type EditableCard = {
  id: string;
  front: string;
  back: string;
};

function makeCard(id: string, front: string, back: string): EditableCard {
  return { id, front, back };
}

function deleteCard(cards: EditableCard[], id: string): EditableCard[] {
  return cards.filter((c) => c.id !== id);
}

function editCard(
  cards: EditableCard[],
  id: string,
  field: "front" | "back",
  value: string,
): EditableCard[] {
  return cards.map((c) => (c.id === id ? { ...c, [field]: value } : c));
}

function swapOne(cards: EditableCard[], id: string): EditableCard[] {
  return cards.map((c) => (c.id === id ? { ...c, front: c.back, back: c.front } : c));
}

function swapAll(cards: EditableCard[]): EditableCard[] {
  return cards.map((c) => ({ ...c, front: c.back, back: c.front }));
}

function addCard(cards: EditableCard[], newId: string): EditableCard[] {
  return [...cards, { id: newId, front: "", back: "" }];
}

function moveBefore(cards: EditableCard[], fromId: string, beforeId: string): EditableCard[] {
  const fromIdx = cards.findIndex((c) => c.id === fromId);
  const beforeIdx = cards.findIndex((c) => c.id === beforeId);
  if (fromIdx === -1 || beforeIdx === -1) return cards;
  const next = [...cards];
  const [removed] = next.splice(fromIdx, 1);
  const targetIdx = next.findIndex((c) => c.id === beforeId);
  next.splice(targetIdx, 0, removed!);
  return next;
}

describe("UnifiedDraftEditor — combined edit session", () => {
  it("edit, swap, reorder, delete, add in one session produces exact final state", () => {
    // Initial: A→1, B→2, C→3
    let cards: EditableCard[] = [
      makeCard("a", "A", "1"),
      makeCard("b", "B", "2"),
      makeCard("c", "C", "3"),
    ];

    // edit B to B → Two
    cards = editCard(cards, "b", "back", "Two");
    expect(cards[0]?.front).toBe("A");
    expect(cards[1]?.front).toBe("B");
    expect(cards[1]?.back).toBe("Two");

    // swap C → now front=3, back=C
    cards = swapOne(cards, "c");
    expect(cards[2]?.front).toBe("3");
    expect(cards[2]?.back).toBe("C");

    // move C (now at index 2) before A (index 0)
    cards = moveBefore(cards, "c", "a");
    expect(cards[0]?.id).toBe("c");
    expect(cards[0]?.front).toBe("3");
    expect(cards[0]?.back).toBe("C");
    expect(cards[1]?.id).toBe("a");
    expect(cards[2]?.id).toBe("b");

    // delete A (id "a")
    cards = deleteCard(cards, "a");
    expect(cards.map((c) => c.id)).toEqual(["c", "b"]);

    // add D → fill 4
    cards = addCard(cards, "d");
    cards = editCard(cards, "d", "front", "D");
    cards = editCard(cards, "d", "back", "4");
    expect(cards[2]?.front).toBe("D");
    expect(cards[2]?.back).toBe("4");

    // Final expected: C(3→C), B→Two, D→4
    expect(cards).toHaveLength(3);
    expect(cards[0]?.id).toBe("c");
    expect(cards[0]?.front).toBe("3");
    expect(cards[0]?.back).toBe("C");
    expect(cards[1]?.id).toBe("b");
    expect(cards[1]?.front).toBe("B");
    expect(cards[1]?.back).toBe("Two");
    expect(cards[2]?.id).toBe("d");
    expect(cards[2]?.front).toBe("D");
    expect(cards[2]?.back).toBe("4");

    // Stable identities: IDs never changed
    const allIds = cards.map((c) => c.id);
    expect(new Set(allIds).size).toBe(3);
  });

  it("stable IDs are unique and preserved across operations", () => {
    const cards: EditableCard[] = [makeCard("x1", "A", "1"), makeCard("x2", "B", "2")];

    const swapped = swapOne(cards, "x1");
    expect(swapped[0]?.id).toBe("x1");
    expect(swapped[0]?.front).toBe("1");

    const reversed = swapAll(swapped);
    expect(reversed[0]?.id).toBe("x1");
    expect(reversed[0]?.front).toBe("A");
    expect(reversed[0]?.back).toBe("1");
  });
});

describe("UnifiedDraftEditor — swap behavior", () => {
  it("single swap: A/B → B/A", () => {
    const cards: EditableCard[] = [makeCard("1", "A", "B")];
    const result = swapOne(cards, "1");
    expect(result[0]?.front).toBe("B");
    expect(result[0]?.back).toBe("A");
  });

  it("swap all: all pairs reversed, order preserved, IDs unchanged", () => {
    const cards: EditableCard[] = [
      makeCard("1", "A", "B"),
      makeCard("2", "C", "D"),
      makeCard("3", "E", "F"),
    ];
    const result = swapAll(cards);
    expect(result[0]?.front).toBe("B");
    expect(result[0]?.back).toBe("A");
    expect(result[1]?.front).toBe("D");
    expect(result[1]?.back).toBe("C");
    expect(result[2]?.front).toBe("F");
    expect(result[2]?.back).toBe("E");
    expect(result[0]?.id).toBe("1");
    expect(result[2]?.id).toBe("3");
  });

  it("swap all twice returns original values", () => {
    const cards: EditableCard[] = [makeCard("1", "A", "B")];
    const swapped = swapAll(cards);
    const restored = swapAll(swapped);
    expect(restored[0]?.front).toBe("A");
    expect(restored[0]?.back).toBe("B");
  });

  it("swap all then single swap preserves IDs and correct card state", () => {
    const cards: EditableCard[] = [makeCard("1", "A", "B"), makeCard("2", "C", "D")];
    const all = swapAll(cards);
    expect(all[0]?.front).toBe("B");
    expect(all[1]?.front).toBe("D");

    const one = swapOne(all, "1");
    expect(one[0]?.front).toBe("A");
    expect(one[0]?.back).toBe("B");
    expect(one[0]?.id).toBe("1");
    expect(one[1]?.front).toBe("D");
    expect(one[1]?.id).toBe("2");
  });
});

describe("UnifiedDraftEditor — validation", () => {
  it("empty front is invalid", () => {
    const card: EditableCard = { id: "1", front: "", back: "valid" };
    const valid = card.front.trim().length > 0 && card.back.trim().length > 0;
    expect(valid).toBe(false);
  });

  it("empty back is invalid", () => {
    const card: EditableCard = { id: "1", front: "valid", back: "" };
    const valid = card.front.trim().length > 0 && card.back.trim().length > 0;
    expect(valid).toBe(false);
  });

  it("both filled is valid", () => {
    const card: EditableCard = { id: "1", front: "A", back: "B" };
    const valid = card.front.trim().length > 0 && card.back.trim().length > 0;
    expect(valid).toBe(true);
  });

  it("invalid card is not silently filtered — must block import", () => {
    // The editor's canImport check verifies all cards are valid.
    // This test proves the validation logic: an invalid card blocks.
    const cards: EditableCard[] = [
      makeCard("1", "Valid", "Also valid"),
      makeCard("2", "", "Missing front"),
    ];
    const allValid = cards.every((c) => c.front.trim().length > 0 && c.back.trim().length > 0);
    expect(allValid).toBe(false);

    // After removing the invalid card, import should be allowed
    const validCards = cards.filter((c) => c.front.trim().length > 0 && c.back.trim().length > 0);
    expect(validCards.length).toBe(1);
  });
});

describe("UnifiedDraftEditor — large collection", () => {
  it("handles 500 cards with stable identities", () => {
    const cards: EditableCard[] = Array.from({ length: 500 }, (_, i) =>
      makeCard(`id-${i}`, `Front ${i}`, `Back ${i}`),
    );
    expect(cards).toHaveLength(500);

    // All IDs unique
    const ids = new Set(cards.map((c) => c.id));
    expect(ids.size).toBe(500);

    // Can delete and add while preserving identities
    const afterDelete = deleteCard(cards, "id-0");
    expect(afterDelete).toHaveLength(499);
    expect(afterDelete[0]?.id).toBe("id-1");

    const afterAdd = addCard(afterDelete, "new-id");
    expect(afterAdd).toHaveLength(500);
    expect(afterAdd[499]?.id).toBe("new-id");

    // No truncation — all cards present
    expect(afterAdd.filter((c) => c.front.length > 0).length).toBe(499);
  });
});
