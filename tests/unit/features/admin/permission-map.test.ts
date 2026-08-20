import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  ADMIN_PERMISSIONS,
  getPermissionsForRoles,
  getRolePermissions,
  hasAdminPermission,
  isAdminRole,
} from "@/features/admin/permission-map";

describe("admin permission map", () => {
  it("gives owner every permission", () => {
    const permissions = getPermissionsForRoles(["owner"]);
    expect(permissions.size).toBe(ADMIN_PERMISSIONS.length);
    for (const permission of ADMIN_PERMISSIONS) {
      expect(permissions.has(permission)).toBe(true);
    }
  });

  it("gives content_admin only catalog capabilities", () => {
    const permissions = getPermissionsForRoles(["content_admin"]);
    expect(permissions).toEqual(new Set(["catalog.read", "catalog.write", "catalog.publish"]));
  });

  it("gives support the documented user/usage/subscription/job capabilities", () => {
    const permissions = getPermissionsForRoles(["support"]);
    expect(permissions).toEqual(
      new Set([
        "users.read",
        "users.status.write",
        "usage.read",
        "usage.adjust",
        "subscriptions.read",
        "subscriptions.override",
        "jobs.read",
        "jobs.retry",
      ]),
    );
  });

  it("gives analyst only read-only capabilities and never mutation", () => {
    const permissions = getPermissionsForRoles(["analyst"]);
    expect(permissions.has("catalog.read")).toBe(true);
    expect(permissions.has("usage.read")).toBe(true);
    expect(permissions.has("subscriptions.read")).toBe(true);
    expect(permissions.has("jobs.read")).toBe(true);
    expect(permissions.has("audit.read")).toBe(true);
    expect(permissions.has("catalog.write")).toBe(false);
    expect(permissions.has("catalog.publish")).toBe(false);
    expect(permissions.has("users.status.write")).toBe(false);
    expect(permissions.has("usage.adjust")).toBe(false);
    expect(permissions.has("subscriptions.override")).toBe(false);
    expect(permissions.has("jobs.retry")).toBe(false);
    expect(permissions.has("roles.manage")).toBe(false);
  });

  it("gives no permissions to an unknown or non-admin role", () => {
    expect(getPermissionsForRoles(["not-a-role"])).toEqual(new Set());
    expect(getPermissionsForRoles([])).toEqual(new Set());
  });

  it("unions permissions across multiple roles", () => {
    const permissions = getPermissionsForRoles(["analyst", "content_admin"]);
    expect(permissions.has("catalog.read")).toBe(true);
    expect(permissions.has("catalog.write")).toBe(true);
    expect(permissions.has("catalog.publish")).toBe(true);
    expect(permissions.has("usage.read")).toBe(true);
    expect(permissions.has("roles.manage")).toBe(false);
  });

  it("guards hasAdminPermission with a fixed set", () => {
    const permissions = getPermissionsForRoles(["support"]);
    expect(hasAdminPermission(permissions, "jobs.retry")).toBe(true);
    expect(hasAdminPermission(permissions, "roles.manage")).toBe(false);
  });

  it("recognizes only the four approved roles", () => {
    expect(isAdminRole("owner")).toBe(true);
    expect(isAdminRole("content_admin")).toBe(true);
    expect(isAdminRole("support")).toBe(true);
    expect(isAdminRole("analyst")).toBe(true);
    expect(isAdminRole("super_admin")).toBe(false);
    expect(isAdminRole("")).toBe(false);
  });

  it("returns the documented role permission lists", () => {
    expect(getRolePermissions("owner")).toEqual(ADMIN_PERMISSIONS);
    expect(getRolePermissions("content_admin")).toEqual([
      "catalog.read",
      "catalog.write",
      "catalog.publish",
    ]);
  });
});
