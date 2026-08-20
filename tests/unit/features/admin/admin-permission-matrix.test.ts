import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  ADMIN_PERMISSIONS,
  ADMIN_ROLES,
  getPermissionsForRoles,
  hasAdminPermission,
  isAdminPermission,
  isAdminRole,
  getRolePermissions,
} from "@/features/admin/permission-map";

describe("admin permission map", () => {
  describe("isAdminRole", () => {
    it("accepts valid roles", () => {
      for (const role of ADMIN_ROLES) {
        expect(isAdminRole(role)).toBe(true);
      }
    });

    it("rejects invalid roles", () => {
      expect(isAdminRole("superadmin")).toBe(false);
      expect(isAdminRole("owner ")).toBe(false);
      expect(isAdminRole("")).toBe(false);
      expect(isAdminRole(null)).toBe(false);
      expect(isAdminRole(undefined)).toBe(false);
    });
  });

  describe("isAdminPermission", () => {
    it("accepts valid permissions", () => {
      for (const perm of ADMIN_PERMISSIONS) {
        expect(isAdminPermission(perm)).toBe(true);
      }
    });

    it("rejects invalid permissions", () => {
      expect(isAdminPermission("admin.all")).toBe(false);
      expect(isAdminPermission("")).toBe(false);
    });
  });

  describe("getPermissionsForRoles", () => {
    it("owner has all permissions", () => {
      const perms = getPermissionsForRoles(["owner"]);
      for (const perm of ADMIN_PERMISSIONS) {
        expect(perms.has(perm)).toBe(true);
      }
    });

    it("analyst has limited permissions", () => {
      const perms = getPermissionsForRoles(["analyst"]);
      expect(perms.has("catalog.read")).toBe(true);
      expect(perms.has("usage.read")).toBe(true);
      expect(perms.has("audit.read")).toBe(true);
      expect(perms.has("catalog.write")).toBe(false);
      expect(perms.has("roles.manage")).toBe(false);
    });

    it("content_admin has catalog permissions", () => {
      const perms = getPermissionsForRoles(["content_admin"]);
      expect(perms.has("catalog.read")).toBe(true);
      expect(perms.has("catalog.write")).toBe(true);
      expect(perms.has("catalog.publish")).toBe(true);
      expect(perms.has("users.read")).toBe(false);
      expect(perms.has("roles.manage")).toBe(false);
    });

    it("support has user/job permissions", () => {
      const perms = getPermissionsForRoles(["support"]);
      expect(perms.has("users.read")).toBe(true);
      expect(perms.has("jobs.read")).toBe(true);
      expect(perms.has("catalog.write")).toBe(false);
      expect(perms.has("roles.manage")).toBe(false);
    });

    it("combines permissions from multiple roles", () => {
      const perms = getPermissionsForRoles(["content_admin", "support"]);
      expect(perms.has("catalog.write")).toBe(true);
      expect(perms.has("users.read")).toBe(true);
      expect(perms.has("roles.manage")).toBe(false);
    });

    it("ignores unknown roles", () => {
      const perms = getPermissionsForRoles(["unknown_role"]);
      expect(perms.size).toBe(0);
    });

    it("returns empty for empty roles", () => {
      const perms = getPermissionsForRoles([]);
      expect(perms.size).toBe(0);
    });
  });

  describe("hasAdminPermission", () => {
    it("returns true when permission exists", () => {
      const perms = getPermissionsForRoles(["owner"]);
      expect(hasAdminPermission(perms, "audit.read")).toBe(true);
    });

    it("returns false when permission missing", () => {
      const perms = getPermissionsForRoles(["analyst"]);
      expect(hasAdminPermission(perms, "roles.manage")).toBe(false);
    });
  });

  describe("getRolePermissions", () => {
    it("owner has all permissions", () => {
      const perms = getRolePermissions("owner");
      expect(perms.length).toBe(ADMIN_PERMISSIONS.length);
    });

    it("analyst has read-only permissions", () => {
      const perms = getRolePermissions("analyst");
      expect(perms.every((p) => p.endsWith(".read"))).toBe(true);
    });
  });

  describe("page permission requirements", () => {
    it("dashboard requires audit.read (any admin role)", () => {
      // Dashboard shows audit section only with audit.read
      // But page itself is accessible with any admin role
      const analystPerms = getPermissionsForRoles(["analyst"]);
      expect(analystPerms.size).toBeGreaterThan(0); // Can access /admin
    });

    it("catalog page requires catalog.read", () => {
      const supportPerms = getPermissionsForRoles(["support"]);
      expect(hasAdminPermission(supportPerms, "catalog.read")).toBe(false);

      const contentAdminPerms = getPermissionsForRoles(["content_admin"]);
      expect(hasAdminPermission(contentAdminPerms, "catalog.read")).toBe(true);
    });

    it("users page requires users.read", () => {
      const contentAdminPerms = getPermissionsForRoles(["content_admin"]);
      expect(hasAdminPermission(contentAdminPerms, "users.read")).toBe(false);

      const supportPerms = getPermissionsForRoles(["support"]);
      expect(hasAdminPermission(supportPerms, "users.read")).toBe(true);
    });

    it("jobs page requires jobs.read", () => {
      const contentAdminPerms = getPermissionsForRoles(["content_admin"]);
      expect(hasAdminPermission(contentAdminPerms, "jobs.read")).toBe(false);

      const supportPerms = getPermissionsForRoles(["support"]);
      expect(hasAdminPermission(supportPerms, "jobs.read")).toBe(true);
    });

    it("audit page requires audit.read", () => {
      const supportPerms = getPermissionsForRoles(["support"]);
      expect(hasAdminPermission(supportPerms, "audit.read")).toBe(false);

      const analystPerms = getPermissionsForRoles(["analyst"]);
      expect(hasAdminPermission(analystPerms, "audit.read")).toBe(true);
    });
  });
});
