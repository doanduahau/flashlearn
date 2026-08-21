import type { UserAuditItem } from "@/features/admin/server/admin-user-queries";

export interface UserAuditHistoryProps {
  auditLogs: UserAuditItem[];
}

export function UserAuditHistory({ auditLogs }: UserAuditHistoryProps) {
  if (auditLogs.length === 0) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-6 text-center text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900">
        Chưa có lịch sử thay đổi quản trị nào trên tài khoản này.
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="border-b border-slate-100 pb-4 dark:border-slate-800">
        <h3 className="text-base font-bold text-slate-900 dark:text-white">
          Lịch sử thay đổi bởi Quản trị viên
        </h3>
        <p className="text-xs text-slate-500">
          Các thao tác điều chỉnh mức dùng và tùy chỉnh quyền lợi đã được ghi nhận.
        </p>
      </div>

      <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800/60">
        {auditLogs.map((log) => {
          let actionLabel = log.action;
          if (log.action === "usage.adjust") actionLabel = "Điều chỉnh mức sử dụng";
          else if (log.action === "entitlement.override") actionLabel = "Tùy chỉnh quyền lợi";
          else if (log.action === "entitlement.override.remove")
            actionLabel = "Gỡ bỏ tùy chỉnh quyền lợi";

          return (
            <div key={log.id} className="py-3 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-900 dark:text-white">{actionLabel}</span>
                <span className="text-[11px] text-slate-400 font-mono">
                  {new Date(log.createdAt).toLocaleString("vi-VN")}
                </span>
              </div>
              <p className="text-slate-600 dark:text-slate-300 italic">
                Lý do: &quot;{log.reason}&quot;
              </p>
              {log.afterSummary && (
                <div className="rounded-xl bg-slate-50 p-2 font-mono text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                  {JSON.stringify(log.afterSummary)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
