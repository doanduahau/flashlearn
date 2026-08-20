"use server";

import {
  AdminAuthorizationError,
  requireAdminPermission,
} from "@/features/admin/server/authorization";
import { isAdminRole, type AdminRole } from "@/features/admin/permission-map";
import { createAdminClient } from "@/lib/supabase/admin";

export type RoleActionResult =
  | { ok: true; roleId: string; role: string; grantedAt?: string; revokedAt?: string }
  | { ok: false; error: string };

export async function grantRoleAction(
  targetUserId: string,
  role: string,
  reason: string,
): Promise<RoleActionResult> {
  try {
    await requireAdminPermission("roles.manage");

    if (!isAdminRole(role)) return { ok: false, error: "Vai trò không hợp lệ." };
    const adminRole = role as AdminRole;

    const { data, error } = await createAdminClient().rpc("grant_admin_role", {
      p_target_user_id: targetUserId,
      p_role: adminRole,
      p_reason: reason,
    });
    if (error || !data?.[0]) {
      return { ok: false, error: `Cấp vai trò thất bại: ${error?.message ?? "không có kết quả"}` };
    }
    const row = data[0];
    return { ok: true, roleId: row.role_id, role: row.role, grantedAt: row.granted_at };
  } catch (error) {
    if (error instanceof AdminAuthorizationError)
      return { ok: false, error: "Không có quyền cấp vai trò." };
    return { ok: false, error: "Lỗi server." };
  }
}

export async function revokeRoleAction(
  targetUserId: string,
  role: string,
  reason: string,
): Promise<RoleActionResult> {
  try {
    await requireAdminPermission("roles.manage");

    if (!isAdminRole(role)) return { ok: false, error: "Vai trò không hợp lệ." };
    const adminRole = role as AdminRole;

    const { data, error } = await createAdminClient().rpc("revoke_admin_role", {
      p_target_user_id: targetUserId,
      p_role: adminRole,
      p_reason: reason,
    });
    if (error || !data?.[0]) {
      return {
        ok: false,
        error: `Thu hồi vai trò thất bại: ${error?.message ?? "không có kết quả"}`,
      };
    }
    const row = data[0];
    return { ok: true, roleId: row.role_id, role: row.role, revokedAt: row.revoked_at };
  } catch (error) {
    if (error instanceof AdminAuthorizationError)
      return { ok: false, error: "Không có quyền thu hồi vai trò." };
    return { ok: false, error: "Lỗi server." };
  }
}
