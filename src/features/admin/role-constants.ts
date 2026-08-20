/**
 * Shared admin role constants and types.
 * This file does NOT import "server-only" so it can be used by both
 * server components and client components (UI labels, form options).
 */

export const ADMIN_ROLES = ["owner", "content_admin", "support", "analyst"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export const ROLE_LABELS: Record<AdminRole, string> = {
  owner: "Owner",
  content_admin: "Content Admin",
  support: "Support",
  analyst: "Analyst",
};

export const ROLE_PERMISSIONS: Record<AdminRole, readonly string[]> = {
  owner: [
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
  ],
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
