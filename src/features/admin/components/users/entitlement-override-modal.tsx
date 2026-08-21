"use client";

import { useState } from "react";
import { overrideUserEntitlementAction } from "@/features/admin/server/admin-user-actions";
import type { EntitlementLimitItem } from "@/features/admin/server/admin-user-queries";

export interface EntitlementOverrideModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUserId: string;
  targetUserEmail: string;
  targetUserName: string;
  planLabel: string;
  limitItem: EntitlementLimitItem | null;
  onSuccess: () => void;
}

export function EntitlementOverrideModal({
  isOpen,
  onClose,
  targetUserId,
  targetUserEmail,
  targetUserName,
  planLabel,
  limitItem,
  onSuccess,
}: EntitlementOverrideModalProps) {
  const [newValueStr, setNewValueStr] = useState<string>(
    limitItem ? String(limitItem.effectiveValue ?? limitItem.baseValue ?? "") : "",
  );
  const [durationDays, setDurationDays] = useState<number>(30);
  const [reason, setReason] = useState<string>("");
  const [step, setStep] = useState<"input" | "confirm">("input");
  const [confirmedExpiresAtIso, setConfirmedExpiresAtIso] = useState<string>("");
  const [confirmedDateStr, setConfirmedDateStr] = useState<string>("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !limitItem) return null;

  const handleProceedToConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (limitItem.valueType === "integer") {
      const num = parseInt(newValueStr, 10);
      if (isNaN(num) || num < 0) {
        setError("Giá trị phải là số nguyên không âm (>= 0).");
        return;
      }
    } else if (limitItem.valueType === "text" && !newValueStr.trim()) {
      setError("Giá trị không được để trống.");
      return;
    }

    if (durationDays < 1 || durationDays > 365) {
      setError("Thời hạn tùy chỉnh phải từ 1 đến 365 ngày.");
      return;
    }

    if (reason.trim().length < 10) {
      setError("Lý do tùy chỉnh phải có ít nhất 10 ký tự.");
      return;
    }

    const targetDate = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
    setConfirmedExpiresAtIso(targetDate.toISOString());
    setConfirmedDateStr(targetDate.toLocaleDateString("vi-VN"));
    setStep("confirm");
  };

  const handleExecute = async () => {
    setIsPending(true);
    setError(null);

    const token = crypto.randomUUID();
    let intVal: number | null = null;
    let boolVal: boolean | null = null;
    let txtVal: string | null = null;

    if (limitItem.valueType === "integer") {
      intVal = parseInt(newValueStr, 10);
    } else if (limitItem.valueType === "boolean") {
      boolVal = newValueStr === "true";
    } else {
      txtVal = newValueStr.trim();
    }

    const res = await overrideUserEntitlementAction({
      target_user_id: targetUserId,
      entitlement_key: limitItem.key,
      value_type: limitItem.valueType,
      integer_value: intVal,
      boolean_value: boolVal,
      text_value: txtVal,
      expires_at: confirmedExpiresAtIso,
      expected_updated_at: limitItem.overrideUpdatedAtRaw ?? null,
      reason: reason.trim(),
      mutation_token: token,
    });

    setIsPending(false);
    if (res.success) {
      onSuccess();
      onClose();
    } else {
      setError(res.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              {limitItem.isOverridden ? "Chỉnh sửa cấu hình riêng" : "Thêm cấu hình riêng"}
            </h3>
            <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
              Chỉ áp dụng cho tài khoản: {targetUserName} ({targetUserEmail})
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-400">
            {error}
          </div>
        )}

        {step === "input" ? (
          <form onSubmit={handleProceedToConfirm} className="mt-4 space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Hạng mục quyền lợi
              </label>
              <div className="mt-1 rounded-xl bg-slate-50 p-3 text-sm font-medium text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                {limitItem.label}
                <span className="ml-2 font-mono text-xs text-slate-400">({limitItem.key})</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-800/40">
                <span className="text-slate-500">Mặc định gói ({planLabel}):</span>
                <p className="mt-1 font-bold font-mono text-slate-800 dark:text-slate-200">
                  {String(limitItem.baseValue ?? "Không có")}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-800/40">
                <span className="text-slate-500">Hiện tại đang áp dụng:</span>
                <p className="mt-1 font-bold font-mono text-emerald-600 dark:text-emerald-400">
                  {String(limitItem.effectiveValue ?? "Không có")}
                </p>
              </div>
            </div>

            <div>
              <label
                htmlFor="override-value"
                className="text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Giá trị cấu hình riêng mới
              </label>
              {limitItem.valueType === "boolean" ? (
                <select
                  id="override-value"
                  value={newValueStr}
                  onChange={(e) => setNewValueStr(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="true">Bật (True)</option>
                  <option value="false">Tắt (False)</option>
                </select>
              ) : (
                <input
                  id="override-value"
                  type={limitItem.valueType === "integer" ? "number" : "text"}
                  min={limitItem.valueType === "integer" ? "0" : undefined}
                  value={newValueStr}
                  onChange={(e) => setNewValueStr(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white font-mono"
                  required
                />
              )}
            </div>

            <div>
              <label
                htmlFor="override-duration"
                className="text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Thời hạn áp dụng (1–365 ngày)
              </label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  id="override-duration"
                  type="number"
                  min="1"
                  max="365"
                  value={durationDays}
                  onChange={(e) => setDurationDays(parseInt(e.target.value, 10) || 1)}
                  className="w-24 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white font-mono"
                  required
                />
                <span className="text-xs text-slate-500">ngày (Tối đa 365 ngày)</span>
              </div>
            </div>

            <div>
              <label
                htmlFor="override-reason"
                className="text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Lý do tùy chỉnh (Bắt buộc, 10–500 ký tự)
              </label>
              <textarea
                id="override-reason"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Nhập lý do chi tiết (ví dụ: Cấp thêm quota đặc biệt cho khách hàng VIP tham gia dự án thử nghiệm...)"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-medium text-white shadow-sm hover:bg-emerald-700"
              >
                Tiếp tục →
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 space-y-2.5 text-xs text-slate-700 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-500">Tài khoản:</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {targetUserName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Gói hiện tại:</span>
                <span className="font-semibold">{planLabel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Hạng mục:</span>
                <span className="font-semibold">{limitItem.label}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Mức gốc của gói:</span>
                <span className="font-mono">{String(limitItem.baseValue ?? "N/A")}</span>
              </div>
              <div className="flex justify-between border-t border-amber-200/60 pt-2 dark:border-amber-900/40">
                <span className="text-slate-500">Mức cấu hình riêng mới:</span>
                <span className="font-bold text-emerald-600 font-mono text-sm">{newValueStr}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Thời hạn áp dụng:</span>
                <span className="font-medium text-slate-900 dark:text-white font-mono">
                  {durationDays} ngày ({confirmedDateStr})
                </span>
              </div>
              <div className="border-t border-amber-200/60 pt-2 dark:border-amber-900/40">
                <span className="text-slate-500">Lý do:</span>
                <p className="mt-1 font-medium text-slate-800 dark:text-slate-200 italic">
                  {reason}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isPending}
                onClick={() => setStep("input")}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
              >
                ← Quay lại
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={handleExecute}
                className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
              >
                {isPending ? "Đang xử lý..." : "Xác nhận & Lưu cấu hình"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
