import "server-only";

export const ADMIN_ROLES = ["owner", "content_admin", "support", "analyst"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export const ADMIN_PERMISSIONS = [
  "catalog.read",
  "catalog.write",
  "catalog.publish",
  "users.read",
  "users.status.write",
  "usage.read",
  "usage.adjust",
  "subscriptions.read",
  "subscriptions.override",
  "jobs.read",
  "jobs.retry",
  "audit.read",
  "roles.manage",
] as const;
export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<AdminRole, readonly AdminPermission[]> = {
  owner: ADMIN_PERMISSIONS,
  content_admin: ["catalog.read", "catalog.write", "catalog.publish"],
  support: [
    "users.read",
    "users.status.write",
    "usage.read",
    "usage.adjust",
    "subscriptions.read",
    "subscriptions.override",
    "jobs.read",
    "jobs.retry",
  ],
  analyst: ["catalog.read", "usage.read", "subscriptions.read", "jobs.read", "audit.read"],
};

export function isAdminRole(value: unknown): value is AdminRole {
  return typeof value === "string" && (ADMIN_ROLES as readonly string[]).includes(value);
}

export function isAdminPermission(value: unknown): value is AdminPermission {
  return typeof value === "string" && (ADMIN_PERMISSIONS as readonly string[]).includes(value);
}

export function getPermissionsForRoles(roles: readonly string[]): ReadonlySet<AdminPermission> {
  const permissions = new Set<AdminPermission>();
  for (const role of roles) {
    if (isAdminRole(role)) {
      for (const permission of ROLE_PERMISSIONS[role]) permissions.add(permission);
    }
  }
  return permissions;
}

export function hasAdminPermission(
  permissions: ReadonlySet<AdminPermission>,
  permission: AdminPermission,
): boolean {
  return permissions.has(permission);
}

export function getRolePermissions(role: AdminRole): readonly AdminPermission[] {
  return ROLE_PERMISSIONS[role];
}
