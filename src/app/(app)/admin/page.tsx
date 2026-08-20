import Link from "next/link";
import { redirect } from "next/navigation";

import {
  AdminAuthorizationError,
  requireAnyAdminRole,
} from "@/features/admin/server/authorization";
import { getPermissionsForRoles, hasAdminPermission } from "@/features/admin/permission-map";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

async function loadDashboardStats(permissions: ReadonlySet<string>) {
  const admin = createAdminClient();
  const stats = {
    totalUsers: 0,
    catalogSets: 0,
    catalogInstalls: 0,
    failedJobs: 0,
    staleJobs: 0,
    recentAuditCount: 0,
  };

  // Total users (bounded count query)
  const { count: totalUsers } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true });
  stats.totalUsers = totalUsers ?? 0;

  // Catalog stats
  if (permissions.has("catalog.read")) {
    const { count: catalogSets } = await admin
      .from("catalog_sets")
      .select("id", { count: "exact", head: true });
    stats.catalogSets = catalogSets ?? 0;

    const { count: catalogInstalls } = await admin
      .from("user_catalog_installs")
      .select("id", { count: "exact", head: true });
    stats.catalogInstalls = catalogInstalls ?? 0;
  }

  // Job stats
  if (permissions.has("jobs.read")) {
    const { count: failedJobs } = await admin
      .from("processing_jobs")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed");
    stats.failedJobs = failedJobs ?? 0;

    const { count: staleJobs } = await admin
      .from("processing_jobs")
      .select("id", { count: "exact", head: true })
      .eq("status", "reconcile_required");
    stats.staleJobs = staleJobs ?? 0;
  }

  // Recent audit count
  if (permissions.has("audit.read")) {
    const { count } = await admin
      .from("admin_audit_logs")
      .select("id", { count: "exact", head: true });
    stats.recentAuditCount = count ?? 0;
  }

  return stats;
}

export default async function AdminPage() {
  let identity;
  try {
    identity = await requireAnyAdminRole();
  } catch (error) {
    if (error instanceof AdminAuthorizationError) redirect("/dashboard");
    throw error;
  }

  const permissions = getPermissionsForRoles(identity.roles);
  const stats = await loadDashboardStats(permissions);

  let audit: Array<{
    id: string;
    action: string;
    created_at: string;
  }> | null = null;
  if (hasAdminPermission(permissions, "audit.read")) {
    const { data } = await createAdminClient().rpc("get_admin_audit_logs", {
      p_limit: 10,
    });
    audit = data ?? null;
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold sm:text-3xl">Tổng quan quản trị</h1>
        <p className="text-sm text-text-secondary">
          Trung tâm vận hành cho đội ngũ quản trị CapyStudy.
        </p>
      </header>

      {/* Roles & Permissions */}
      <section className="rounded-2xl border border-border-soft bg-surface p-4 shadow-soft-card sm:rounded-3xl sm:p-6">
        <h2 className="text-base font-bold sm:text-lg">Vai trò và quyền</h2>
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
        <div className="mt-3 flex flex-wrap gap-1.5">
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

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Người dùng" value={stats.totalUsers} />
        <StatCard label="Bộ thư viện" value={stats.catalogSets} />
        <StatCard label="Lượt cài đặt" value={stats.catalogInstalls} />
        <StatCard
          label="Công việc lỗi"
          value={stats.failedJobs}
          tone={stats.failedJobs > 0 ? "danger" : undefined}
        />
        <StatCard
          label="Cần xử lý"
          value={stats.staleJobs}
          tone={stats.staleJobs > 0 ? "warning" : undefined}
        />
        <StatCard label="Nhật ký" value={stats.recentAuditCount} />
      </div>

      {/* Quick Links */}
      <div className="flex flex-wrap gap-2">
        {hasAdminPermission(permissions, "catalog.read") && (
          <Link
            href="/admin/catalog"
            className="inline-flex items-center gap-1.5 rounded-xl border border-border-soft bg-surface px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-subtle hover:text-text-primary"
          >
            Quản lý thư viện →
          </Link>
        )}
        {hasAdminPermission(permissions, "users.read") && (
          <Link
            href="/admin/users"
            className="inline-flex items-center gap-1.5 rounded-xl border border-border-soft bg-surface px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-subtle hover:text-text-primary"
          >
            Tra cứu người dùng →
          </Link>
        )}
        {hasAdminPermission(permissions, "jobs.read") && (
          <Link
            href="/admin/jobs"
            className="inline-flex items-center gap-1.5 rounded-xl border border-border-soft bg-surface px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-subtle hover:text-text-primary"
          >
            Xem công việc →
          </Link>
        )}
        {hasAdminPermission(permissions, "audit.read") && (
          <Link
            href="/admin/audit"
            className="inline-flex items-center gap-1.5 rounded-xl border border-border-soft bg-surface px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-subtle hover:text-text-primary"
          >
            Nhật ký kiểm toán →
          </Link>
        )}
      </div>

      {/* Recent Audit */}
      {audit && audit.length > 0 && (
        <section className="rounded-2xl border border-border-soft bg-surface p-4 shadow-soft-card sm:rounded-3xl sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-bold sm:text-lg">Nhật ký gần đây</h2>
            <Link
              href="/admin/audit"
              className="inline-flex items-center gap-1 rounded-lg border border-border-soft bg-surface px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-subtle hover:text-text-primary"
            >
              Xem tất cả
            </Link>
          </div>
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
        </section>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: Readonly<{
  label: string;
  value: number;
  tone?: "danger" | "warning";
}>) {
  return (
    <div className="rounded-2xl border border-border-soft bg-surface p-4 shadow-soft-card">
      <p className="text-xs text-text-secondary">{label}</p>
      <p
        className={`mt-1 text-2xl font-bold ${
          tone === "danger"
            ? "text-danger"
            : tone === "warning"
              ? "text-warning"
              : "text-text-primary"
        }`}
      >
        {value.toLocaleString("vi-VN")}
      </p>
    </div>
  );
}
