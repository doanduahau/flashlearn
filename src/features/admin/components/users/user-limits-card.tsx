"use client";

import type { EntitlementLimitItem } from "@/features/admin/server/admin-user-queries";

export interface UserLimitsCardProps {
  limits: EntitlementLimitItem[];
  planLabel: string;
  canMutate: boolean;
  onOpenOverrideModal: (item: EntitlementLimitItem) => void;
  onOpenRemoveModal: (item: EntitlementLimitItem) => void;
}

export function UserLimitsCard({
  limits,
  planLabel,
  canMutate,
  onOpenOverrideModal,
  onOpenRemoveModal,
}: UserLimitsCardProps) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col justify-between gap-2 border-b border-slate-100 pb-4 sm:flex-row sm:items-center dark:border-slate-800">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Hạn mức & Quyền lợi đang áp dụng
          </h3>
          <p className="text-xs text-slate-500">
            Tất cả tùy chỉnh ở đây chỉ áp dụng riêng cho tài khoản này (không thay đổi gói{" "}
            {planLabel} toàn hệ thống).
          </p>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-400 dark:border-slate-800">
              <th className="px-4 py-3">Hạng mục quyền lợi</th>
              <th className="px-4 py-3">Mặc định gói ({planLabel})</th>
              <th className="px-4 py-3">Giá trị áp dụng thực tế</th>
              <th className="px-4 py-3">Nguồn cấu hình</th>
              {canMutate && <th className="px-4 py-3 text-right">Thao tác</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {limits.map((item) => (
              <tr key={item.key} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                <td className="px-4 py-3.5">
                  <div className="flex flex-col">
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {item.label}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">{item.key}</span>
                  </div>
                </td>
                <td className="px-4 py-3.5 font-mono text-slate-500">
                  {String(item.baseValue ?? "Không có")}
                </td>
                <td className="px-4 py-3.5">
                  <span
                    className={`font-mono font-bold text-sm ${
                      item.isOverridden
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-slate-800 dark:text-slate-200"
                    }`}
                  >
                    {String(item.effectiveValue ?? "Không có")}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  {item.isOverridden ? (
                    <div className="flex flex-col gap-1">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 w-fit">
                        ★ Cấu hình riêng
                      </span>
                      {item.overrideExpiresAt && (
                        <span className="text-[10px] text-slate-400">
                          Hết hạn: {new Date(item.overrideExpiresAt).toLocaleDateString("vi-VN")}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                      Theo gói {planLabel}
                    </span>
                  )}
                </td>
                {canMutate && (
                  <td className="px-4 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => onOpenOverrideModal(item)}
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                      >
                        {item.isOverridden ? "Sửa" : "Tùy chỉnh"}
                      </button>
                      {item.isOverridden && (
                        <button
                          type="button"
                          onClick={() => onOpenRemoveModal(item)}
                          className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-400"
                        >
                          Gỡ bỏ
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
