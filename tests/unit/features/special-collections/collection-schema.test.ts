import { describe, expect, it } from "vitest";

import {
  createCollectionSchema,
  deleteCollectionSchema,
  removeCollectionItemSchema,
  renameCollectionSchema,
  updateCardCollectionsSchema,
} from "@/features/special-collections/schemas/collection-schema";
import { COLLECTION_MAX_MEMBERSHIP_IDS, COLLECTION_NAME_MAX_LENGTH } from "@/lib/constants";

const COLLECTION_ID = "11111111-1111-4111-8111-111111111111";
const CARD_ID = "22222222-2222-4222-8222-222222222222";

describe("collection schemas", () => {
  it("accepts a valid trimmed collection name", () => {
    const result = createCollectionSchema.safeParse({ name: "  Khó nhớ  " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBe("Khó nhớ");
  });

  it("rejects an empty or whitespace-only name", () => {
    expect(createCollectionSchema.safeParse({ name: "" }).success).toBe(false);
    expect(createCollectionSchema.safeParse({ name: "   " }).success).toBe(false);
  });

  it("rejects a name longer than the limit", () => {
    expect(
      createCollectionSchema.safeParse({ name: "a".repeat(COLLECTION_NAME_MAX_LENGTH + 1) })
        .success,
    ).toBe(false);
    expect(
      createCollectionSchema.safeParse({ name: "a".repeat(COLLECTION_NAME_MAX_LENGTH) }).success,
    ).toBe(true);
  });

  it("requires a valid collection id for rename and delete", () => {
    expect(renameCollectionSchema.safeParse({ collectionId: "nope", name: "Bộ" }).success).toBe(
      false,
    );
    expect(
      renameCollectionSchema.safeParse({ collectionId: COLLECTION_ID, name: "Bộ" }).success,
    ).toBe(true);
    expect(deleteCollectionSchema.safeParse({ collectionId: "nope" }).success).toBe(false);
    expect(deleteCollectionSchema.safeParse({ collectionId: COLLECTION_ID }).success).toBe(true);
  });

  it("requires valid ids for removing a collection item", () => {
    expect(
      removeCollectionItemSchema.safeParse({ collectionId: "nope", cardId: CARD_ID }).success,
    ).toBe(false);
    expect(
      removeCollectionItemSchema.safeParse({ collectionId: COLLECTION_ID, cardId: "nope" }).success,
    ).toBe(false);
    expect(
      removeCollectionItemSchema.safeParse({ collectionId: COLLECTION_ID, cardId: CARD_ID })
        .success,
    ).toBe(true);
  });

  it("accepts an empty collection list for a card sync", () => {
    const result = updateCardCollectionsSchema.safeParse({
      cardId: CARD_ID,
      setId: COLLECTION_ID,
      collectionIds: [],
    });
    expect(result.success).toBe(true);
  });

  it("rejects more than the membership limit in one sync", () => {
    expect(
      updateCardCollectionsSchema.safeParse({
        cardId: CARD_ID,
        setId: COLLECTION_ID,
        collectionIds: Array.from({ length: COLLECTION_MAX_MEMBERSHIP_IDS + 1 }, (_, index) =>
          String(index).padStart(8, "0").repeat(5).slice(0, 36),
        ),
      }).success,
    ).toBe(false);
  });

  it("rejects invalid ids inside the collection list", () => {
    expect(
      updateCardCollectionsSchema.safeParse({
        cardId: CARD_ID,
        setId: COLLECTION_ID,
        collectionIds: [COLLECTION_ID, "not-a-uuid"],
      }).success,
    ).toBe(false);
  });
});
