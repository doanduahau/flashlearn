import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  getPermissionsForRoles,
  hasAdminPermission as hasPermission,
  isAdminRole,
  type AdminPermission,
  type AdminRole,
} from "@/features/admin/permission-map";

export class AdminAuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminAuthorizationError";
  }
}

export type AdminIdentity = {
  userId: string;
  roles: AdminRole[];
};

async function resolveSessionIdentity(): Promise<AdminIdentity | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return null;
  return { userId: user.id, roles: [] };
}

async function loadRoles(userId: string): Promise<AdminRole[]> {
  const { data, error } = await createAdminClient().rpc("get_effective_admin_roles", {
    p_user_id: userId,
  });
  if (error || !data) return [];
  return data.map((row) => row.role).filter((role): role is AdminRole => isAdminRole(role));
}

/**
 * Returns the active admin roles for the current authenticated session.
 * Identity always comes from the verified session; the browser never supplies
 * a user id or role, so a forged payload cannot influence the result.
 */
export async function getCurrentAdminRoles(): Promise<AdminRole[]> {
  const identity = await resolveSessionIdentity();
  if (!identity) return [];
  return loadRoles(identity.userId);
}

/**
 * Returns the effective permission set for the current session, derived from the
 * typed permission map. This is the single place that maps roles to capabilities.
 */
export async function getEffectiveAdminPermissions(): Promise<ReadonlySet<AdminPermission>> {
  const roles = await getCurrentAdminRoles();
  return getPermissionsForRoles(roles);
}

export async function hasAdminPermission(permission: AdminPermission): Promise<boolean> {
  const permissions = await getEffectiveAdminPermissions();
  return hasPermission(permissions, permission);
}

/**
 * Guard used by server actions and route handlers before touching admin data.
 * Throws a typed error; callers decide how to surface it (redirect/forbidden).
 */
export async function requireAdminPermission(permission: AdminPermission): Promise<AdminIdentity> {
  const identity = await resolveSessionIdentity();
  if (!identity) {
    throw new AdminAuthorizationError("authentication required");
  }
  const roles = await loadRoles(identity.userId);
  const permissions = getPermissionsForRoles(roles);
  if (!hasPermission(permissions, permission)) {
    throw new AdminAuthorizationError(`admin permission denied: ${permission}`);
  }
  return { userId: identity.userId, roles };
}

/**
 * Route guard for the admin hub: requires at least one active admin role so the
 * page is reachable by every admin role, while the specific server actions and
 * data loads inside it re-check the narrower permission they actually need.
 */
export async function requireAnyAdminRole(): Promise<AdminIdentity> {
  const identity = await resolveSessionIdentity();
  if (!identity) {
    throw new AdminAuthorizationError("authentication required");
  }
  const roles = await loadRoles(identity.userId);
  if (roles.length === 0) {
    throw new AdminAuthorizationError("admin access denied");
  }
  return { userId: identity.userId, roles };
}
