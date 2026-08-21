"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { swapStarterSetAction } from "@/features/admin/server/admin-catalog-actions";
import type { AdminCatalogSetDetail } from "@/features/admin/server/admin-catalog-queries";

export interface CatalogStarterSwapDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentDraftSet: AdminCatalogSetDetail;
  activeStarters: Array<{
    id: string;
    title: string;
    slug: string;
    starterOrder: number;
    updatedAt: string;
  }>;
}

export function CatalogStarterSwapDialog({
  isOpen,
  onClose,
  currentDraftSet,
  activeStarters,
}: CatalogStarterSwapDialogProps) {
  const router = useRouter();
  const [selectedOldStarterId, setSelectedOldStarterId] = useState(activeStarters[0]?.id || "");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!isOpen) return null;

  const selectedOldStarter = activeStarters.find((s) => s.id === selectedOldStarterId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOldStarter) {
      setError("Vui lòng chọn bộ starter hiện tại cần thay thế.");
      return;
    }
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      setError("Vui lòng nhập lý do thay thế starter (bắt buộc cho kiểm toán)");
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await swapStarterSetAction({
        old_starter_set_id: selectedOldStarter.id,
        new_draft_set_id: currentDraftSet.id,
        expected_updated_at_old: selectedOldStarter.updatedAt,
        expected_updated_at_new: currentDraftSet.updatedAt,
        reason: trimmedReason,
      });

      if (result.success) {
        onClose();
        router.refresh();
      } else {
        setError(result.message);
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900 dark:border dark:border-slate-800">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
          Thay thế Bộ Starter Onboarding (Atomic Swap)
        </h3>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Thao tác này sẽ xuất bản bộ bản thảo hiện tại thành Starter mới và chuyển bộ Starter cũ về
          bộ thường (vẫn xuất bản), duy trì chính xác 3 bộ Starter cho hệ thống.
        </p>

        {error && (
          <div className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/30 dark:text-rose-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Chọn Bộ Starter hiện tại muốn thay thế <span className="text-rose-500">*</span>
            </label>
            <div className="mt-2 space-y-2">
              {activeStarters.map((starter) => (
                <label
                  key={starter.id}
                  className={`flex cursor-pointer items-center justify-between rounded-xl border p-3 text-sm transition ${
                    selectedOldStarterId === starter.id
                      ? "border-emerald-500 bg-emerald-50/50 text-emerald-900 dark:border-emerald-500 dark:bg-emerald-950/30 dark:text-emerald-300"
                      : "border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="selectedOldStarter"
                      value={starter.id}
                      checked={selectedOldStarterId === starter.id}
                      onChange={() => setSelectedOldStarterId(starter.id)}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <span className="font-semibold">Vị trí #{starter.starterOrder}: </span>
                      <span>{starter.title}</span>
                    </div>
                  </div>
                  <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-400">
                    {starter.slug}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-800/50 dark:text-slate-400">
            <div>
              <span className="font-semibold">Bộ mới thăng hạng:</span> {currentDraftSet.title} (
              {currentDraftSet.cardCount} thẻ)
            </div>
            <div className="mt-1">
              <span className="font-semibold">Vị trí tiếp quản:</span> #
              {selectedOldStarter?.starterOrder ?? "?"}
            </div>
          </div>

          <div>
            <label
              htmlFor="swap-reason"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Lý do thay thế Starter <span className="text-rose-500">*</span>
            </label>
            <textarea
              id="swap-reason"
              rows={2}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="VD: Cập nhật bộ từ vựng hoa quả revision mới chất lượng cao hơn..."
              className="mt-1 block w-full rounded-xl border border-slate-300 p-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isPending || !reason.trim() || !selectedOldStarterId}
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
            >
              {isPending && (
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              )}
              Xác nhận Thay thế Starter
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
