import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  AdminAuthorizationError,
  requireAdminPermission,
} from "@/features/admin/server/authorization";
import { isAdminRole, type AdminRole } from "@/features/admin/permission-map";

export type GrantAdminRoleInput = {
  targetUserId: string;
  role: string;
  reason: string;
  correlationId?: string;
};

export type RevokeAdminRoleInput = GrantAdminRoleInput;

export type RoleMutationResult = {
  roleId: string;
  role: string;
  grantedAt?: string;
  revokedAt?: string;
};

/**
 * Server-only role mutation boundary. The actor is always the authenticated
 * session (requireAdminPermission), so a client cannot forge the actor, target
 * or role. The trusted RPC re-validates everything inside the database.
 */
export async function grantAdminRole(input: GrantAdminRoleInput): Promise<RoleMutationResult> {
  await requireAdminPermission("roles.manage");

  if (!isAdminRole(input.role)) {
    throw new AdminAuthorizationError("invalid role");
  }
  const role = input.role as AdminRole;

  const { data, error } = await createAdminClient().rpc("grant_admin_role", {
    p_target_user_id: input.targetUserId,
    p_role: role,
    p_reason: input.reason,
    p_correlation_id: input.correlationId,
  });
  if (error || !data?.[0]) {
    throw new AdminAuthorizationError(`role grant failed: ${error?.message ?? "no result"}`);
  }
  const row = data[0];
  return {
    roleId: row.role_id,
    role: row.role,
    grantedAt: row.granted_at,
  };
}

export async function revokeAdminRole(input: RevokeAdminRoleInput): Promise<RoleMutationResult> {
  await requireAdminPermission("roles.manage");

  if (!isAdminRole(input.role)) {
    throw new AdminAuthorizationError("invalid role");
  }
  const role = input.role as AdminRole;

  const { data, error } = await createAdminClient().rpc("revoke_admin_role", {
    p_target_user_id: input.targetUserId,
    p_role: role,
    p_reason: input.reason,
    p_correlation_id: input.correlationId,
  });
  if (error || !data?.[0]) {
    throw new AdminAuthorizationError(`role revoke failed: ${error?.message ?? "no result"}`);
  }
  const row = data[0];
  return {
    roleId: row.role_id,
    role: row.role,
    revokedAt: row.revoked_at,
  };
}
