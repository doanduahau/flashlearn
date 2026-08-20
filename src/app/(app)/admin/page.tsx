import Link from "next/link";
import { redirect } from "next/navigation";

import {
  AdminAuthorizationError,
  requireAnyAdminRole,
} from "@/features/admin/server/authorization";
import { getPermissionsForRoles, hasAdminPermission } from "@/features/admin/permission-map";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function AdminPage() {
  let identity;
  try {
    identity = await requireAnyAdminRole();
  } catch (error) {
    if (error instanceof AdminAuthorizationError) redirect("/dashboard");
    throw error;
  }

  const permissions = getPermissionsForRoles(identity.roles);
  const canReadAudit = hasAdminPermission(permissions, "audit.read");

  let audit: Array<{
    id: string;
    action: string;
    created_at: string;
  }> | null = null;
  if (canReadAudit) {
    const { data } = await createAdminClient().rpc("get_admin_audit_logs", { p_limit: 10 });
    audit = data ?? null;
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold sm:text-3xl">Khu vực quản trị</h1>
        <p className="text-sm text-text-secondary">
          Trung tâm vận hành cho đội ngũ quản trị CapyStudy.
        </p>
      </header>

      <section className="rounded-2xl border border-border-soft bg-surface p-4 shadow-soft-card sm:rounded-3xl sm:p-6">
        <h2 className="text-base font-bold sm:text-lg">Vai trò và quyền của bạn</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {identity.roles.map((role) => (
            <span
              key={role}
              className="rounded-full bg-primary-soft px-3 py-1 text-sm font-medium text-primary-foreground"
            >
              {role}
            </span>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {[...permissions].map((permission) => (
            <span
              key={permission}
              className="rounded-md border border-border-soft bg-surface-subtle px-2 py-0.5 text-xs text-text-secondary"
            >
              {permission}
            </span>
          ))}
        </div>
      </section>

      {canReadAudit ? (
        <section className="rounded-2xl border border-border-soft bg-surface p-4 shadow-soft-card sm:rounded-3xl sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-bold sm:text-lg">Nhật ký kiểm toán gần đây</h2>
            <Link
              href="/admin/audit"
              className="inline-flex items-center gap-1 rounded-lg border border-border-soft bg-surface px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-subtle hover:text-text-primary"
            >
              Xem tất cả
            </Link>
          </div>
          {audit && audit.length > 0 ? (
            <ul className="mt-3 divide-y divide-border-soft">
              {audit.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0 truncate font-mono text-xs text-text-secondary">
                    {entry.action}
                  </span>
                  <span className="shrink-0 text-xs text-text-secondary">
                    {new Date(entry.created_at).toLocaleString("vi-VN")}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-text-secondary">Chưa có nhật ký kiểm toán.</p>
          )}
        </section>
      ) : null}
    </div>
  );
}
