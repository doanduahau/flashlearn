import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({ auth: { getUser: mocks.getUser } }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc: mocks.rpc }),
}));

import { AdminAuthorizationError } from "@/features/admin/server/authorization";
import { grantAdminRole, revokeAdminRole } from "@/features/admin/server/role-service";

const OWNER_ID = "aaaaaaaa-0000-4000-8000-000000000001";
const TARGET_ID = "bbbbbbbb-0000-4000-8000-000000000002";

function sessionUser(id: string | null) {
  mocks.getUser.mockResolvedValue({ data: { user: id ? { id } : null }, error: null });
}

describe("admin role service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionUser(OWNER_ID);
    mocks.rpc.mockResolvedValue({
      data: [{ role: "owner" }],
      error: null,
    });
  });

  it("grants a role through the trusted RPC and returns the new row", async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: [{ role: "owner" }],
      error: null,
    });
    mocks.rpc.mockResolvedValue({
      data: [
        {
          role_id: "cccccccc-0000-4000-8000-000000000003",
          role: "support",
          granted_at: "2026-08-20T00:00:00Z",
        },
      ],
      error: null,
    });

    const result = await grantAdminRole({
      targetUserId: TARGET_ID,
      role: "support",
      reason: "hiring support staff",
      correlationId: "corr-1",
    });

    expect(result).toEqual({
      roleId: "cccccccc-0000-4000-8000-000000000003",
      role: "support",
      grantedAt: "2026-08-20T00:00:00Z",
    });
    expect(mocks.rpc).toHaveBeenCalledWith("grant_admin_role", {
      p_target_user_id: TARGET_ID,
      p_role: "support",
      p_reason: "hiring support staff",
      p_correlation_id: "corr-1",
    });
  });

  it("revokes a role and returns the revoked row", async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: [{ role: "owner" }],
      error: null,
    });
    mocks.rpc.mockResolvedValue({
      data: [
        {
          role_id: "cccccccc-0000-4000-8000-000000000003",
          role: "support",
          revoked_at: "2026-08-21T00:00:00Z",
        },
      ],
      error: null,
    });

    const result = await revokeAdminRole({
      targetUserId: TARGET_ID,
      role: "support",
      reason: "left the team",
    });

    expect(result.revokedAt).toBe("2026-08-21T00:00:00Z");
    expect(mocks.rpc).toHaveBeenCalledWith("revoke_admin_role", {
      p_target_user_id: TARGET_ID,
      p_role: "support",
      p_reason: "left the team",
      p_correlation_id: undefined,
    });
  });

  it("throws when the caller lacks roles.manage", async () => {
    sessionUser(null);
    await expect(
      grantAdminRole({ targetUserId: TARGET_ID, role: "owner", reason: "escalate" }),
    ).rejects.toThrow("authentication required");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("throws for an invalid role before calling the mutation RPC", async () => {
    await expect(
      grantAdminRole({ targetUserId: TARGET_ID, role: "super_admin", reason: "x" }),
    ).rejects.toThrow(AdminAuthorizationError);
    expect(mocks.rpc).not.toHaveBeenCalledWith("grant_admin_role", expect.anything());
  });

  it("throws when the trusted RPC rejects", async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: [{ role: "owner" }],
      error: null,
    });
    mocks.rpc.mockResolvedValue({ data: null, error: new Error("db says no") });
    await expect(
      grantAdminRole({ targetUserId: TARGET_ID, role: "support", reason: "x" }),
    ).rejects.toThrow(AdminAuthorizationError);
  });
});
