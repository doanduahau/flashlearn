import { redirect } from "next/navigation";

import {
  AdminAuthorizationError,
  requireAdminPermission,
} from "@/features/admin/server/authorization";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function AdminAuditPage() {
  try {
    await requireAdminPermission("audit.read");
  } catch (error) {
    if (error instanceof AdminAuthorizationError) redirect("/admin");
    throw error;
  }

  const { data, error } = await createAdminClient().rpc("get_admin_audit_logs", {
    p_limit: 200,
  });

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold sm:text-3xl">Nhật ký kiểm toán</h1>
        <p className="text-sm text-text-secondary">Toàn bộ hoạt động quản trị đã ghi lại.</p>
      </header>

      {error ? (
        <p
          role="alert"
          className="rounded-2xl border border-border-soft bg-surface p-4 text-danger"
        >
          Không thể tải nhật ký kiểm toán.
        </p>
      ) : data && data.length > 0 ? (
        <div className="overflow-x-auto rounded-2xl border border-border-soft bg-surface shadow-soft-card">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-border-soft text-xs uppercase tracking-wide text-text-secondary">
                <th className="px-4 py-3">Thời điểm</th>
                <th className="px-4 py-3">Hành động</th>
                <th className="px-4 py-3">Người thực hiện</th>
                <th className="px-4 py-3">Đối tượng</th>
                <th className="px-4 py-3">Lý do</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-soft">
              {data.map((entry) => (
                <tr key={entry.id}>
                  <td className="whitespace-nowrap px-4 py-2.5 text-xs text-text-secondary">
                    {new Date(entry.created_at).toLocaleString("vi-VN")}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs">{entry.action}</td>
                  <td className="px-4 py-2.5 text-xs text-text-secondary">{entry.actor ?? "—"}</td>
                  <td className="px-4 py-2.5 text-xs text-text-secondary">
                    {entry.target_type}:{entry.target_id}
                  </td>
                  <td className="max-w-[280px] truncate px-4 py-2.5 text-xs">{entry.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-2xl border border-border-soft bg-surface p-4 text-text-secondary">
          Chưa có nhật ký kiểm toán.
        </p>
      )}
    </div>
  );
}
