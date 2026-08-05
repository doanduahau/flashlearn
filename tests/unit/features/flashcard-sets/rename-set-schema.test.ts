import { describe, expect, it } from "vitest";

import { renameSetSchema } from "@/features/flashcard-sets/schemas/set-schema";

const SET_ID = "11111111-1111-4111-8111-111111111111";

describe("renameSetSchema", () => {
  it("trims outer whitespace from the name", () => {
    const result = renameSetSchema.safeParse({ setId: SET_ID, name: "  Xin chào  " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBe("Xin chào");
  });

  it("rejects blank and whitespace-only names", () => {
    expect(renameSetSchema.safeParse({ setId: SET_ID, name: "" }).success).toBe(false);
    expect(renameSetSchema.safeParse({ setId: SET_ID, name: "   " }).success).toBe(false);
    expect(renameSetSchema.safeParse({ setId: SET_ID, name: "\n\t " }).success).toBe(false);
  });

  it("rejects names longer than the database limit", () => {
    const result = renameSetSchema.safeParse({ setId: SET_ID, name: "a".repeat(121) });
    expect(result.success).toBe(false);
  });

  it("accepts names at the database limit", () => {
    const result = renameSetSchema.safeParse({ setId: SET_ID, name: "a".repeat(120) });
    expect(result.success).toBe(true);
  });

  it("allows duplicate names", () => {
    const a = renameSetSchema.safeParse({ setId: SET_ID, name: "Trùng tên" });
    const b = renameSetSchema.safeParse({
      setId: "22222222-2222-4222-8222-222222222222",
      name: "Trùng tên",
    });
    expect(a.success).toBe(true);
    expect(b.success).toBe(true);
  });

  it("rejects invalid and malformed set ids", () => {
    expect(renameSetSchema.safeParse({ setId: "not-a-uuid", name: "Tên" }).success).toBe(false);
    expect(renameSetSchema.safeParse({ name: "Tên" }).success).toBe(false);
    expect(renameSetSchema.safeParse(null).success).toBe(false);
    expect(renameSetSchema.safeParse("plain string").success).toBe(false);
    expect(renameSetSchema.safeParse({ setId: SET_ID }).success).toBe(false);
  });
});
