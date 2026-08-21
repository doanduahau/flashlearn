"use client";

import { useState } from "react";
import { removeUserEntitlementOverrideAction } from "@/features/admin/server/admin-user-actions";
import type { EntitlementLimitItem } from "@/features/admin/server/admin-user-queries";

export interface EntitlementRemoveModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUserId: string;
  targetUserEmail: string;
  targetUserName: string;
  planLabel: string;
  limitItem: EntitlementLimitItem | null;
  onSuccess: () => void;
}

export function EntitlementRemoveModal({
  isOpen,
  onClose,
  targetUserId,
  targetUserEmail,
  targetUserName,
  planLabel,
  limitItem,
  onSuccess,
}: EntitlementRemoveModalProps) {
  const [reason, setReason] = useState<string>("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !limitItem || !limitItem.isOverridden) return null;

  const handleExecute = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (reason.trim().length < 10) {
      setError("Lý do gỡ bỏ phải có ít nhất 10 ký tự.");
      return;
    }

    setIsPending(true);
    const token = crypto.randomUUID();

    const res = await removeUserEntitlementOverrideAction({
      target_user_id: targetUserId,
      entitlement_key: limitItem.key,
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
            <h3 className="text-lg font-bold text-rose-600 dark:text-rose-400">
              Gỡ bỏ cấu hình riêng
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

        <form onSubmit={handleExecute} className="mt-4 space-y-4">
          <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-4 space-y-2 text-xs text-slate-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-slate-300">
            <div className="flex justify-between">
              <span className="text-slate-500">Hạng mục:</span>
              <span className="font-semibold">{limitItem.label}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Mức cấu hình riêng hiện tại:</span>
              <span className="font-bold text-rose-600 font-mono">
                {String(limitItem.effectiveValue)}
              </span>
            </div>
            <div className="flex justify-between border-t border-rose-200/60 pt-2 dark:border-rose-900/40">
              <span className="text-slate-500">Dự kiến sau khi gỡ:</span>
              <span className="font-bold text-emerald-600 font-mono">
                {String(limitItem.baseValue)} (Khôi phục mặc định {planLabel})
              </span>
            </div>
          </div>

          <div>
            <label
              htmlFor="remove-reason"
              className="text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              Lý do gỡ bỏ cấu hình (Bắt buộc, 10–500 ký tự)
            </label>
            <textarea
              id="remove-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Nhập lý do chi tiết (ví dụ: Hết hạn chương trình hỗ trợ, khôi phục hạn mức gói gốc...)"
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-rose-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-xl bg-rose-600 px-5 py-2 text-xs font-medium text-white shadow-sm hover:bg-rose-700 disabled:opacity-50"
            >
              {isPending ? "Đang gỡ..." : "Xác nhận gỡ bỏ cấu hình"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
