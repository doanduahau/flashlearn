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
