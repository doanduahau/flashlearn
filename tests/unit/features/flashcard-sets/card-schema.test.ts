import { describe, expect, it } from "vitest";

import { createCardSchema, updateCardSchema } from "@/features/flashcard-sets/schemas/set-schema";

const SET_ID = "11111111-1111-4111-8111-111111111111";
const CARD_ID = "22222222-2222-4222-8222-222222222222";

describe("card schemas", () => {
  it("createCardSchema trims outer whitespace and preserves content", () => {
    const result = createCardSchema.safeParse({
      setId: SET_ID,
      front: "  Xin chào  ",
      back: "  Hello  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.front).toBe("Xin chào");
      expect(result.data.back).toBe("Hello");
    }
  });

  it("preserves Unicode, Vietnamese, multiline text and case", () => {
    const front = "  Dòng 1\nDòng 2 — Tiếng Việt: Ộ Ắ ừ  \n";
    const back = "  Line 1\nLine 2 - UPPER/lower  ";
    const result = createCardSchema.safeParse({ setId: SET_ID, front, back });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.front).toBe("Dòng 1\nDòng 2 — Tiếng Việt: Ộ Ắ ừ");
      expect(result.data.back).toBe("Line 1\nLine 2 - UPPER/lower");
    }
  });

  it("rejects whitespace-only front or back", () => {
    expect(createCardSchema.safeParse({ setId: SET_ID, front: "   ", back: "ok" }).success).toBe(
      false,
    );
    expect(createCardSchema.safeParse({ setId: SET_ID, front: "ok", back: "\n\t " }).success).toBe(
      false,
    );
    expect(createCardSchema.safeParse({ setId: SET_ID, front: "", back: "ok" }).success).toBe(
      false,
    );
    expect(createCardSchema.safeParse({ setId: SET_ID, front: "ok", back: "" }).success).toBe(
      false,
    );
  });

  it("rejects front or back over the database limit", () => {
    expect(
      createCardSchema.safeParse({ setId: SET_ID, front: "a".repeat(50001), back: "ok" }).success,
    ).toBe(false);
    expect(
      createCardSchema.safeParse({ setId: SET_ID, front: "ok", back: "b".repeat(50001) }).success,
    ).toBe(false);
  });

  it("accepts front or back at the database limit", () => {
    const result = createCardSchema.safeParse({
      setId: SET_ID,
      front: "a".repeat(50000),
      back: "b".repeat(50000),
    });
    expect(result.success).toBe(true);
  });

  it("does not accept user_id, position or other client-supplied ownership fields", () => {
    const result = createCardSchema.safeParse({
      setId: SET_ID,
      front: "front",
      back: "back",
      user_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      position: 99,
      owner: "attacker",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("user_id");
      expect(result.data).not.toHaveProperty("position");
      expect(result.data).not.toHaveProperty("owner");
    }
  });

  it("updateCardSchema requires a valid card id", () => {
    const valid = updateCardSchema.safeParse({
      setId: SET_ID,
      cardId: CARD_ID,
      front: "front",
      back: "back",
    });
    expect(valid.success).toBe(true);
    expect(updateCardSchema.safeParse({ setId: SET_ID, front: "f", back: "b" }).success).toBe(
      false,
    );
    expect(
      updateCardSchema.safeParse({ setId: SET_ID, cardId: "nope", front: "f", back: "b" }).success,
    ).toBe(false);
  });

  it("rejects malformed payloads", () => {
    expect(createCardSchema.safeParse(null).success).toBe(false);
    expect(createCardSchema.safeParse(42).success).toBe(false);
    expect(createCardSchema.safeParse({ setId: SET_ID, front: 123, back: "ok" }).success).toBe(
      false,
    );
  });
});
