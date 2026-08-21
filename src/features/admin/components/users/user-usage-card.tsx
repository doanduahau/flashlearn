"use client";

import type { UsageMeterItem } from "@/features/admin/server/admin-user-queries";

export interface UserUsageCardProps {
  usageMeters: UsageMeterItem[];
  canMutate: boolean;
  onOpenAdjustModal: (meter: UsageMeterItem) => void;
}

export function UserUsageCard({ usageMeters, canMutate, onOpenAdjustModal }: UserUsageCardProps) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Mức sử dụng & Hạn ngạch hiện tại
          </h3>
          <p className="text-xs text-slate-500">
            Theo dõi mức tiêu thụ tài nguyên thực tế của tài khoản này trong chu kỳ.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {usageMeters.map((meter) => {
          const percent =
            meter.limit > 0 ? Math.min(100, Math.round((meter.consumed / meter.limit) * 100)) : 0;
          const isHigh = percent >= 80;

          return (
            <div
              key={meter.key}
              className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/40"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {meter.label}
                  </span>
                  <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-mono text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                    {meter.periodKind === "rolling_day" ? "24 giờ" : "Hàng tháng"}
                  </span>
                </div>

                <div className="mt-3 flex items-baseline justify-between text-xs">
                  <span className="font-mono text-lg font-bold text-slate-900 dark:text-white">
                    {meter.consumed.toLocaleString("vi-VN")}
                  </span>
                  <span className="text-slate-500 font-mono">
                    / {meter.limit.toLocaleString("vi-VN")} {meter.unit}
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                  <div
                    className={`h-full transition-all duration-300 ${
                      isHigh ? "bg-amber-500" : "bg-emerald-500"
                    }`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>

              {canMutate && (
                <div className="mt-4 border-t border-slate-200/60 pt-3 dark:border-slate-700/50 flex justify-end">
                  <button
                    type="button"
                    onClick={() => onOpenAdjustModal(meter)}
                    className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"
                  >
                    Điều chỉnh mức dùng
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
