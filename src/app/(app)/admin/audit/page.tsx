import { redirect } from "next/navigation";

import {
  AdminAuthorizationError,
  requireAdminPermission,
} from "@/features/admin/server/authorization";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function AdminAuditPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    page?: string;
    action?: string;
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

  const admin = createAdminClient();

  // Query with pagination using RPC
  const { data, error } = await admin.rpc("get_admin_audit_logs", {
    p_limit: PAGE_SIZE + 1, // Fetch one extra to detect next page
    ...(actionFilter ? { p_target_type: actionFilter } : {}),
  });

  const entries = data ?? [];
  const hasNext = entries.length > PAGE_SIZE;
  const displayEntries = hasNext ? entries.slice(0, PAGE_SIZE) : entries;

  function buildUrl(overrides: Record<string, string>) {
    const sp = new URLSearchParams();
    const p = overrides.page ?? String(page);
    if (p !== "1") sp.set("page", p);
    if (overrides.action ?? actionFilter) sp.set("action", overrides.action ?? actionFilter);
    const qs = sp.toString();
    return `/admin/audit${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold sm:text-3xl">Nhật ký kiểm toán</h1>
        <p className="text-sm text-text-secondary">
          Hoạt động quản trị đã ghi lại. Mỗi bản ghi là append-only.
        </p>
      </header>

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
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-border-soft text-xs uppercase tracking-wide text-text-secondary">
                  <th className="px-4 py-3">Thời điểm</th>
                  <th className="px-4 py-3">Hành động</th>
                  <th className="px-4 py-3">Đối tượng</th>
                  <th className="px-4 py-3">Lý do</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-soft">
                {displayEntries.map((entry: Record<string, unknown>) => (
                  <tr key={entry.id as string}>
                    <td className="whitespace-nowrap px-4 py-2.5 text-xs text-text-secondary">
                      {new Date(entry.created_at as string).toLocaleString("vi-VN")}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs">{entry.action as string}</td>
                    <td className="px-4 py-2.5 text-xs text-text-secondary">
                      {entry.target_type as string}:{(entry.target_id as string).slice(0, 8)}…
                    </td>
                    <td className="max-w-[280px] truncate px-4 py-2.5 text-xs">
                      {entry.reason as string}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
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
    </div>
  );
}
