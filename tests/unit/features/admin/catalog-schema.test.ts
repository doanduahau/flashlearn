import { describe, expect, it } from "vitest";

import {
  catalogLifecycleActionSchema,
  createCatalogSetSchema,
  replaceCatalogCardsSchema,
  swapStarterSetSchema,
  updateCatalogMetadataSchema,
} from "@/features/admin/schemas/catalog-schema";

describe("Catalog Schemas", () => {
  describe("createCatalogSetSchema", () => {
    it("validates valid input successfully", () => {
      const valid = {
        category_id: "00000000-0000-4000-8000-000000000000",
        slug: "tieng-anh-trai-cay",
        title: "50 Từ vựng Trái cây",
        description: "Mô tả bộ thẻ",
        language_front: "vi",
        language_back: "en",
        level: "A1",
        tags: ["trai cay", "tu vung"],
      };
      const result = createCatalogSetSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("rejects invalid slug format with uppercase or special characters", () => {
      const invalid = {
        category_id: "00000000-0000-4000-8000-000000000000",
        slug: "Tiếng Anh_123!",
        title: "Title",
      };
      const result = createCatalogSetSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.slug).toBeDefined();
      }
    });

    it("rejects empty title", () => {
      const invalid = {
        category_id: "00000000-0000-4000-8000-000000000000",
        slug: "valid-slug",
        title: "   ",
      };
      const result = createCatalogSetSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe("updateCatalogMetadataSchema", () => {
    it("validates full replacement metadata and preserves raw expected_updated_at string", () => {
      const valid = {
        catalog_set_id: "00000000-0000-4000-8000-000000000001",
        expected_updated_at: "2026-08-21T10:15:30.123456+00:00",
        title: "Updated Title",
        description: "Updated description",
        category_id: "00000000-0000-4000-8000-000000000000",
        language_front: "vi",
        language_back: "en",
        level: "B1",
        tags: ["tag1", "tag2"],
        slug: "updated-slug",
      };
      const result = updateCatalogMetadataSchema.safeParse(valid);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.expected_updated_at).toBe("2026-08-21T10:15:30.123456+00:00");
      }
    });
  });

  describe("replaceCatalogCardsSchema", () => {
    it("accepts empty array for draft cards", () => {
      const valid = {
        catalog_set_id: "00000000-0000-4000-8000-000000000001",
        expected_updated_at: "2026-08-21T10:15:30.123456+00:00",
        cards: [],
        reason: "Save empty draft cards",
      };
      const result = replaceCatalogCardsSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("rejects when reason is missing or empty", () => {
      const invalid = {
        catalog_set_id: "00000000-0000-4000-8000-000000000001",
        expected_updated_at: "2026-08-21T10:15:30.123456+00:00",
        cards: [{ front: "Apple", back: "Táo" }],
        reason: "   ",
      };
      const result = replaceCatalogCardsSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("rejects when cards exceed 2000 editor safety cap", () => {
      const invalid = {
        catalog_set_id: "00000000-0000-4000-8000-000000000001",
        expected_updated_at: "2026-08-21T10:15:30.123456+00:00",
        cards: Array(2001).fill({ front: "A", back: "B" }),
        reason: "Too many cards",
      };
      const result = replaceCatalogCardsSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe("swapStarterSetSchema", () => {
    it("validates valid swap input", () => {
      const valid = {
        old_starter_set_id: "00000000-0000-4000-8000-000000000001",
        new_draft_set_id: "00000000-0000-4000-8000-000000000002",
        expected_updated_at_old: "2026-08-21T10:00:00.000000+00:00",
        expected_updated_at_new: "2026-08-21T10:05:00.000000+00:00",
        reason: "Replace starter 1 with revision 2",
      };
      const result = swapStarterSetSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });
  });

  describe("catalogLifecycleActionSchema", () => {
    it("requires human reason for publish/unpublish/archive/restore", () => {
      const valid = {
        catalog_set_id: "00000000-0000-4000-8000-000000000001",
        expected_updated_at: "2026-08-21T10:15:30.123456+00:00",
        reason: "Official public release",
      };
      const result = catalogLifecycleActionSchema.safeParse(valid);
      expect(result.success).toBe(true);

      const invalid = {
        catalog_set_id: "00000000-0000-4000-8000-000000000001",
        expected_updated_at: "2026-08-21T10:15:30.123456+00:00",
        reason: "",
      };
      expect(catalogLifecycleActionSchema.safeParse(invalid).success).toBe(false);
    });
  });
});
