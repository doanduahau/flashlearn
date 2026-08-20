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

import {
  AdminAuthorizationError,
  getCurrentAdminRoles,
  getEffectiveAdminPermissions,
  hasAdminPermission,
  requireAdminPermission,
  requireAnyAdminRole,
} from "@/features/admin/server/authorization";

const USER_ID = "aaaaaaaa-0000-4000-8000-000000000001";

function sessionUser(id: string | null) {
  mocks.getUser.mockResolvedValue({ data: { user: id ? { id } : null }, error: null });
}

describe("admin authorization helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionUser(USER_ID);
  });

  it("returns no roles when the session is unauthenticated", async () => {
    sessionUser(null);
    await expect(getCurrentAdminRoles()).resolves.toEqual([]);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("loads active roles from the trusted RPC only", async () => {
    mocks.rpc.mockResolvedValue({
      data: [{ role: "owner" }, { role: "support" }],
      error: null,
    });
    await expect(getCurrentAdminRoles()).resolves.toEqual(["owner", "support"]);
    expect(mocks.rpc).toHaveBeenCalledWith("get_effective_admin_roles", {
      p_user_id: USER_ID,
    });
  });

  it("ignores unknown roles returned by the RPC", async () => {
    mocks.rpc.mockResolvedValue({
      data: [{ role: "super_admin" }, { role: "support" }],
      error: null,
    });
    await expect(getCurrentAdminRoles()).resolves.toEqual(["support"]);
  });

  it("returns an empty set when the RPC errors", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: new Error("boom") });
    await expect(getEffectiveAdminPermissions()).resolves.toEqual(new Set());
  });

  it("maps roles through the centralized permission map", async () => {
    mocks.rpc.mockResolvedValue({ data: [{ role: "analyst" }], error: null });
    const permissions = await getEffectiveAdminPermissions();
    expect(permissions.has("usage.read")).toBe(true);
    expect(permissions.has("usage.adjust")).toBe(false);
  });

  it("hasAdminPermission is true when granted", async () => {
    mocks.rpc.mockResolvedValue({ data: [{ role: "owner" }], error: null });
    await expect(hasAdminPermission("roles.manage")).resolves.toBe(true);
  });

  it("hasAdminPermission is false when not granted", async () => {
    mocks.rpc.mockResolvedValue({ data: [{ role: "content_admin" }], error: null });
    await expect(hasAdminPermission("roles.manage")).resolves.toBe(false);
  });

  it("requireAdminPermission resolves with identity when granted", async () => {
    mocks.rpc.mockResolvedValue({ data: [{ role: "owner" }], error: null });
    await expect(requireAdminPermission("roles.manage")).resolves.toEqual({
      userId: USER_ID,
      roles: ["owner"],
    });
  });

  it("requireAdminPermission throws when the permission is missing", async () => {
    mocks.rpc.mockResolvedValue({ data: [{ role: "analyst" }], error: null });
    await expect(requireAdminPermission("roles.manage")).rejects.toThrow(AdminAuthorizationError);
  });

  it("requireAdminPermission throws when unauthenticated", async () => {
    sessionUser(null);
    await expect(requireAdminPermission("usage.read")).rejects.toThrow("authentication required");
  });

  it("requireAnyAdminRole resolves for a user holding any admin role", async () => {
    mocks.rpc.mockResolvedValue({ data: [{ role: "analyst" }], error: null });
    await expect(requireAnyAdminRole()).resolves.toEqual({
      userId: USER_ID,
      roles: ["analyst"],
    });
  });

  it("requireAnyAdminRole throws when the user holds no admin role", async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null });
    await expect(requireAnyAdminRole()).rejects.toThrow("admin access denied");
  });

  it("requireAnyAdminRole throws when unauthenticated", async () => {
    sessionUser(null);
    await expect(requireAnyAdminRole()).rejects.toThrow("authentication required");
  });
});
