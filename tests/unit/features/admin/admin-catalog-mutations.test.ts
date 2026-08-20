import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock server-only imports
vi.mock("server-only", () => ({}));

// Mock authorization
const mockRequirePermission = vi.fn();
vi.mock("@/features/admin/server/authorization", () => ({
  AdminAuthorizationError: class extends Error {
    constructor(msg: string) {
      super(msg);
      this.name = "AdminAuthorizationError";
    }
  },
  requireAdminPermission: (...args: unknown[]) => mockRequirePermission(...args),
}));

// Mock admin client
const mockRpc = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    rpc: mockRpc,
  }),
}));

// Mock revalidatePath
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import {
  adminPublishCatalogSet,
  adminUnpublishCatalogSet,
  adminArchiveCatalogSet,
  adminReplaceCatalogCards,
} from "@/features/admin/server/admin-catalog-actions";

describe("admin catalog mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue({
      userId: "actor-123",
      roles: ["owner"],
    });
  });

  describe("adminPublishCatalogSet", () => {
    it("publishes a catalog set successfully", async () => {
      mockRpc.mockResolvedValue({
        data: [
          { id: "set-1", version: 2, status: "published", published_at: "2026-01-01T00:00:00Z" },
        ],
        error: null,
      });
      const result = await adminPublishCatalogSet("set-1", "Ready to publish");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.version).toBe(2);
        expect(result.status).toBe("published");
      }
      expect(mockRpc).toHaveBeenCalledWith(
        "admin_publish_catalog_set",
        expect.objectContaining({
          p_actor_user_id: "actor-123",
          p_catalog_set_id: "set-1",
          p_reason: "Ready to publish",
        }),
      );
    });

    it("rejects already published set", async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: "already published" },
      });
      const result = await adminPublishCatalogSet("set-1", "reason");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("đã được xuất bản");
      }
    });

    it("rejects unauthorized user", async () => {
      mockRequirePermission.mockRejectedValue(new Error("admin permission denied"));
      const result = await adminPublishCatalogSet("set-1", "reason");
      expect(result.ok).toBe(false);
    });
  });

  describe("adminUnpublishCatalogSet", () => {
    it("unpublishes successfully", async () => {
      mockRpc.mockResolvedValue({
        data: [{ id: "set-1", version: 2, status: "draft" }],
        error: null,
      });
      const result = await adminUnpublishCatalogSet("set-1", "Need changes");
      expect(result.ok).toBe(true);
    });

    it("rejects non-published set", async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: "set is not published" },
      });
      const result = await adminUnpublishCatalogSet("set-1", "reason");
      expect(result.ok).toBe(false);
    });
  });

  describe("adminArchiveCatalogSet", () => {
    it("archives successfully", async () => {
      mockRpc.mockResolvedValue({
        data: [{ id: "set-1", status: "archived" }],
        error: null,
      });
      const result = await adminArchiveCatalogSet("set-1", "No longer needed");
      expect(result.ok).toBe(true);
    });

    it("rejects already archived", async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: "already archived" },
      });
      const result = await adminArchiveCatalogSet("set-1", "reason");
      expect(result.ok).toBe(false);
    });
  });

  describe("adminReplaceCatalogCards", () => {
    it("replaces cards successfully", async () => {
      mockRpc.mockResolvedValue({
        data: [{ card_count: 3 }],
        error: null,
      });
      const result = await adminReplaceCatalogCards("set-1", [
        { front: "Hello", back: "Xin chào" },
        { front: "Goodbye", back: "Tạm biệt" },
        { front: "Thank", back: "Cảm ơn" },
      ]);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.card_count).toBe(3);
      }
    });

    it("rejects more than 2000 cards", async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: "max 2000 cards per catalog set" },
      });
      const cards = Array.from({ length: 2001 }, (_, i) => ({
        front: `Card ${i}`,
        back: `Thẻ ${i}`,
      }));
      const result = await adminReplaceCatalogCards("set-1", cards);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("2000");
      }
    });
  });
});
