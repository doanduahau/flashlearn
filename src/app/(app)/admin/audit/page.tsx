import { redirect } from "next/navigation";

import {
  AdminAuthorizationError,
  requireAdminPermission,
} from "@/features/admin/server/authorization";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuditDetailDrawer } from "./audit-detail-client";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function AdminAuditPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    page?: string;
    action?: string;
    target_type?: string;
  }>;
}>) {
  try {
    await requireAdminPermission("audit.read");
  } catch (error) {
    if (error instanceof AdminAuthorizationError) redirect("/admin");
    throw error;
  }

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1", 10) || 1);
  const actionFilter = params.action?.trim() || "";
  const targetTypeFilter = params.target_type?.trim() || "";

  const admin = createAdminClient();

  const { data, error } = await admin.rpc("get_admin_audit_logs", {
    p_limit: PAGE_SIZE + 1,
    ...(targetTypeFilter ? { p_target_type: targetTypeFilter } : {}),
    ...(actionFilter ? { p_actor: actionFilter } : {}),
  });

  const entries = data ?? [];
  const hasNext = entries.length > PAGE_SIZE;
  const displayEntries = hasNext ? entries.slice(0, PAGE_SIZE) : entries;

  // Resolve actor display names
  const actorIds = [
    ...new Set(
      displayEntries.map((e: Record<string, unknown>) => e.actor as string).filter(Boolean),
    ),
  ];
  const actorMap = new Map<string, string>();
  if (actorIds.length > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, display_name")
      .in("id", actorIds);
    for (const p of profiles ?? []) {
      actorMap.set(p.id, p.display_name ?? "—");
    }
  }

  function buildUrl(overrides: Record<string, string>) {
    const sp = new URLSearchParams();
    const p = overrides.page ?? String(page);
    if (p !== "1") sp.set("page", p);
    const a = overrides.action ?? actionFilter;
    if (a) sp.set("action", a);
    const t = overrides.target_type ?? targetTypeFilter;
    if (t) sp.set("target_type", t);
    const qs = sp.toString();
    return `/admin/audit${qs ? `?${qs}` : ""}`;
  }

  const actionTypes = [
    "catalog.publish",
    "catalog.unpublish",
    "catalog.archive",
    "catalog.update",
    "catalog.replace_cards",
    "usage.adjust",
    "entitlement.override",
    "job.retry",
    "role.grant",
    "role.revoke",
  ];

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold sm:text-3xl">Nhật ký kiểm toán</h1>
        <p className="text-sm text-text-secondary">
          Hoạt động quản trị đã ghi lại. Mỗi bản ghi là append-only.
        </p>
      </header>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="audit-action" className="text-xs text-text-secondary">
            Hành động
          </label>
          <select
            id="audit-action"
            defaultValue={actionFilter}
            onChange={undefined}
            className="rounded-xl border border-border-soft bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
          >
            <option value="">Tất cả</option>
            {actionTypes.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="audit-target" className="text-xs text-text-secondary">
            Đối tượng
          </label>
          <select
            id="audit-target"
            defaultValue={targetTypeFilter}
            className="rounded-xl border border-border-soft bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
          >
            <option value="">Tất cả</option>
            <option value="catalog_set">Bộ thư viện</option>
            <option value="user">Người dùng</option>
            <option value="processing_job">Công việc</option>
          </select>
        </div>
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-2xl border border-border-soft bg-surface p-4 text-danger"
        >
          Không thể tải nhật ký kiểm toán.
        </div>
      ) : displayEntries.length === 0 ? (
        <div className="rounded-2xl border border-border-soft bg-surface p-8 text-center text-text-secondary">
          Chưa có nhật ký kiểm toán.
        </div>
      ) : (
        <>
          <p className="text-xs text-text-secondary">
            Trang {page}
            {hasNext ? " · Còn trang sau" : " · Trang cuối"}
          </p>
          <div className="overflow-x-auto rounded-2xl border border-border-soft bg-surface shadow-soft-card">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead>
                <tr className="border-b border-border-soft text-xs uppercase tracking-wide text-text-secondary">
                  <th className="px-4 py-3">Thời điểm</th>
                  <th className="px-4 py-3">Actor</th>
                  <th className="px-4 py-3">Hành động</th>
                  <th className="px-4 py-3">Đối tượng</th>
                  <th className="px-4 py-3">Lý do</th>
                  <th className="px-4 py-3">Chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-soft">
                {displayEntries.map((entry: Record<string, unknown>) => (
                  <tr key={entry.id as string} className="hover:bg-surface-subtle">
                    <td className="whitespace-nowrap px-4 py-2.5 text-xs text-text-secondary">
                      {new Date(entry.created_at as string).toLocaleString("vi-VN")}
                    </td>
                    <td className="px-4 py-2.5 text-xs">
                      {entry.actor
                        ? (actorMap.get(entry.actor as string) ??
                          (entry.actor as string).slice(0, 8) + "…")
                        : "—"}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs">{entry.action as string}</td>
                    <td className="px-4 py-2.5 text-xs text-text-secondary">
                      {entry.target_type as string}:{(entry.target_id as string).slice(0, 8)}…
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-2.5 text-xs">
                      {entry.reason as string}
                    </td>
                    <td className="px-4 py-2.5">
                      <AuditDetailDrawer entry={entry} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <nav className="flex items-center justify-center gap-2" aria-label="Phân trang">
            {page > 1 && (
              <a
                href={buildUrl({ page: String(page - 1) })}
                className="rounded-lg border border-border-soft bg-surface px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-subtle"
              >
                ← Trước
              </a>
            )}
            <span className="text-sm text-text-secondary">Trang {page}</span>
            {hasNext && (
              <a
                href={buildUrl({ page: String(page + 1) })}
                className="rounded-lg border border-border-soft bg-surface px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-subtle"
              >
                Tiếp →
              </a>
            )}
          </nav>
        </>
      )}

      <p className="text-xs text-text-secondary">
        🔒 Nhật ký chỉ đọc, không thể chỉnh sửa hoặc xóa.
      </p>
    </div>
  );
}
