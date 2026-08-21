"use client";

import { useState } from "react";
import { adjustUserUsageAction } from "@/features/admin/server/admin-user-actions";
import type { UsageMeterItem } from "@/features/admin/server/admin-user-queries";

export interface UsageAdjustModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUserId: string;
  targetUserEmail: string;
  targetUserName: string;
  meter: UsageMeterItem | null;
  onSuccess: () => void;
}

export function UsageAdjustModal({
  isOpen,
  onClose,
  targetUserId,
  targetUserEmail,
  targetUserName,
  meter,
  onSuccess,
}: UsageAdjustModalProps) {
  const [direction, setDirection] = useState<"credit" | "debit">("credit");
  const [amountStr, setAmountStr] = useState<string>("50");
  const [reason, setReason] = useState<string>("");
  const [step, setStep] = useState<"input" | "confirm">("input");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !meter) return null;

  const parsedAmount = parseInt(amountStr, 10) || 0;
  // Positive amount = credit (adds budget/allowance, decreases consumed)
  // Negative amount = debit (consumes budget/allowance, increases consumed)
  const signedAmount = direction === "credit" ? Math.abs(parsedAmount) : -Math.abs(parsedAmount);
  const resultingConsumed = Math.max(0, meter.consumed - signedAmount);
  const resultingHeadroom = Math.max(0, meter.limit - resultingConsumed);

  const handleProceedToConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (parsedAmount <= 0 || parsedAmount > 10000) {
      setError("Số lượng điều chỉnh phải từ 1 đến 10,000.");
      return;
    }
    if (reason.trim().length < 10) {
      setError("Lý do điều chỉnh phải có ít nhất 10 ký tự.");
      return;
    }
    setStep("confirm");
  };

  const handleExecute = async () => {
    setIsPending(true);
    setError(null);

    const token = crypto.randomUUID();
    const res = await adjustUserUsageAction({
      target_user_id: targetUserId,
      usage_key: meter.key,
      amount: signedAmount,
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
              {step === "input" ? "Điều chỉnh mức sử dụng" : "Xác nhận điều chỉnh"}
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
                Hạng mục
              </label>
              <div className="mt-1 rounded-xl bg-slate-50 p-3 text-sm font-medium text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                {meter.label} ({meter.key})
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Loại điều chỉnh
              </label>
              <div className="mt-1 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDirection("credit")}
                  className={`rounded-xl border p-2.5 text-xs font-semibold transition ${
                    direction === "credit"
                      ? "border-emerald-600 bg-emerald-50 text-emerald-700 dark:border-emerald-500 dark:bg-emerald-950/30 dark:text-emerald-300"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400"
                  }`}
                >
                  + Cộng thêm lượt (Credit)
                </button>
                <button
                  type="button"
                  onClick={() => setDirection("debit")}
                  className={`rounded-xl border p-2.5 text-xs font-semibold transition ${
                    direction === "debit"
                      ? "border-amber-600 bg-amber-50 text-amber-700 dark:border-amber-500 dark:bg-amber-950/30 dark:text-amber-300"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400"
                  }`}
                >
                  - Khấu trừ lượt (Debit)
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="adjust-amount"
                className="text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Số lượng ({meter.unit})
              </label>
              <input
                id="adjust-amount"
                type="number"
                min="1"
                max="10000"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                required
              />
            </div>

            <div>
              <label
                htmlFor="adjust-reason"
                className="text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Lý do điều chỉnh (Bắt buộc, 10–500 ký tự)
              </label>
              <textarea
                id="adjust-reason"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Nhập lý do chi tiết (ví dụ: Hỗ trợ khách hàng gặp sự cố gián đoạn dịch vụ...)"
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
                <span className="text-slate-500">Hạng mục:</span>
                <span className="font-semibold">{meter.label}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Hiện tại đã dùng:</span>
                <span className="font-mono">
                  {meter.consumed} / {meter.limit} {meter.unit}
                </span>
              </div>
              <div className="flex justify-between border-t border-amber-200/60 pt-2 dark:border-amber-900/40">
                <span className="text-slate-500">Mức điều chỉnh:</span>
                <span
                  className={`font-bold font-mono ${signedAmount > 0 ? "text-emerald-600" : "text-amber-600"}`}
                >
                  {signedAmount > 0 ? `+${signedAmount}` : signedAmount} {meter.unit}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Dự kiến sau điều chỉnh:</span>
                <span className="font-bold text-slate-900 dark:text-white font-mono">
                  {resultingConsumed} / {meter.limit} {meter.unit} (Còn lại: {resultingHeadroom}{" "}
                  {meter.unit})
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
                {isPending ? "Đang xử lý..." : "Xác nhận & Áp dụng"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
