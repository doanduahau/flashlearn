import { redirect } from "next/navigation";

import {
  AdminAuthorizationError,
  requireAdminPermission,
} from "@/features/admin/server/authorization";
import { createAdminClient } from "@/lib/supabase/admin";
import { RoleManagementPanel } from "@/features/admin/components/role-management-panel";

export const dynamic = "force-dynamic";

export default async function AdminRolesPage() {
  try {
    await requireAdminPermission("roles.manage");
  } catch (error) {
    if (error instanceof AdminAuthorizationError) redirect("/admin");
    throw error;
  }

  // Load all active roles
  const admin = createAdminClient();
  const { data: rolesData } = await admin
    .from("user_roles")
    .select("id, user_id, role, created_at, created_by")
    .is("revoked_at", null)
    .order("created_at", { ascending: false });

  // Resolve display names for role holders
  const userIds = [...new Set((rolesData ?? []).map((r) => r.user_id))];
  const profilesMap = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, display_name")
      .in("id", userIds);
    for (const p of profiles ?? []) {
      profilesMap.set(p.id, p.display_name ?? "—");
    }
  }

  const enrichedRoles = (rolesData ?? []).map((r) => ({
    ...r,
    display_name: profilesMap.get(r.user_id) ?? "—",
  }));

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold sm:text-3xl">Quản lý vai trò</h1>
        <p className="text-sm text-text-secondary">
          Chỉ owner có thể cấp hoặc thu hồi vai trò quản trị.
        </p>
      </header>

      <RoleManagementPanel roles={enrichedRoles} />
    </div>
  );
}
