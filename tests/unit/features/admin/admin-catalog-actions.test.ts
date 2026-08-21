import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  createCatalogSetAction,
  publishCatalogSetAction,
  replaceCatalogCardsAction,
  swapStarterSetAction,
  updateCatalogMetadataAction,
} from "@/features/admin/server/admin-catalog-actions";
import * as authorizationModule from "@/features/admin/server/authorization";
import * as featureFlagsModule from "@/lib/telemetry/feature-flags";

// Mock dependencies
const mockRpc = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    rpc: mockRpc,
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("Admin Catalog Server Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(featureFlagsModule, "getFeatureFlags").mockReturnValue({
      catalogEnabled: true,
      starterProvisioningEnabled: true,
      quotaEnforcementMode: "observe",
      adminConsoleEnabled: true,
      adminCatalogMutationsEnabled: true,
      billingEnabled: false,
    });
  });

  it("fails closed with MUTATIONS_DISABLED when feature flag is off", async () => {
    vi.spyOn(featureFlagsModule, "getFeatureFlags").mockReturnValue({
      catalogEnabled: true,
      starterProvisioningEnabled: true,
      quotaEnforcementMode: "observe",
      adminConsoleEnabled: true,
      adminCatalogMutationsEnabled: false,
      billingEnabled: false,
    });

    const result = await createCatalogSetAction({
      category_id: "00000000-0000-4000-8000-000000000000",
      slug: "test-slug",
      title: "Test Title",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("MUTATIONS_DISABLED");
    }
  });

  it("denies action when user lacks required permission", async () => {
    vi.spyOn(authorizationModule, "requireAdminPermission").mockRejectedValue(
      new authorizationModule.AdminAuthorizationError("admin permission denied: catalog.write"),
    );

    const result = await createCatalogSetAction({
      category_id: "00000000-0000-4000-8000-000000000000",
      slug: "test-slug",
      title: "Test Title",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("PERMISSION_DENIED");
    }
  });

  it("maps SQL P0004 to STALE_DATA error", async () => {
    vi.spyOn(authorizationModule, "requireAdminPermission").mockResolvedValue({
      userId: "11111111-2222-3333-4444-555555555555",
      roles: ["owner"],
    });

    mockRpc.mockResolvedValue({
      data: null,
      error: {
        message: "P0004: catalog set has been modified by another admin; reload before saving",
      },
    });

    const result = await updateCatalogMetadataAction({
      catalog_set_id: "00000000-0000-4000-8000-000000000001",
      expected_updated_at: "2026-08-21T10:00:00.000Z",
      title: "New Title",
      category_id: "00000000-0000-4000-8000-000000000000",
      language_front: "vi",
      language_back: "en",
      tags: [],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("STALE_DATA");
    }
  });

  it("successfully calls admin_publish_catalog_set with verified server actor", async () => {
    vi.spyOn(authorizationModule, "requireAdminPermission").mockResolvedValue({
      userId: "11111111-2222-3333-4444-555555555555",
      roles: ["owner"],
    });

    mockRpc.mockResolvedValue({
      data: [
        {
          out_id: "00000000-0000-4000-8000-000000000001",
          out_version: 2,
          out_status: "published",
          out_published_at: "2026-08-21T12:00:00.000Z",
          out_updated_at: "2026-08-21T12:00:00.000Z",
        },
      ],
      error: null,
    });

    const result = await publishCatalogSetAction({
      catalog_set_id: "00000000-0000-4000-8000-000000000001",
      expected_updated_at: "2026-08-21T10:00:00.000Z",
      reason: "Publish revision 2",
    });

    expect(result.success).toBe(true);
    expect(mockRpc).toHaveBeenCalledWith("admin_publish_catalog_set", {
      p_actor_user_id: "11111111-2222-3333-4444-555555555555",
      p_catalog_set_id: "00000000-0000-4000-8000-000000000001",
      p_expected_updated_at: "2026-08-21T10:00:00.000Z",
      p_reason: "Publish revision 2",
    });
  });

  it("checks both catalog.write and catalog.publish for swapStarterSetAction", async () => {
    const authSpy = vi.spyOn(authorizationModule, "requireAdminPermission").mockResolvedValue({
      userId: "11111111-2222-3333-4444-555555555555",
      roles: ["owner"],
    });

    mockRpc.mockResolvedValue({
      data: [
        {
          out_old_id: "00000000-0000-4000-8000-000000000001",
          out_new_id: "00000000-0000-4000-8000-000000000002",
          out_starter_order: 1,
          out_new_version: 1,
        },
      ],
      error: null,
    });

    const result = await swapStarterSetAction({
      old_starter_set_id: "00000000-0000-4000-8000-000000000001",
      new_draft_set_id: "00000000-0000-4000-8000-000000000002",
      expected_updated_at_old: "2026-08-21T10:00:00.000Z",
      expected_updated_at_new: "2026-08-21T10:05:00.000Z",
      reason: "Swap starter 1",
    });

    expect(result.success).toBe(true);
    expect(authSpy).toHaveBeenCalledWith("catalog.write");
    expect(authSpy).toHaveBeenCalledWith("catalog.publish");
  });
});
