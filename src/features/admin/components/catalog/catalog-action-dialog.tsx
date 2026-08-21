"use client";

import { useState, useTransition } from "react";

export interface CatalogActionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description: string;
  actionLabel: string;
  actionVariant?: "primary" | "danger" | "warning";
  onConfirm: (reason: string) => Promise<{ success: boolean; message?: string }>;
}

export function CatalogActionDialog({
  isOpen,
  onClose,
  title,
  description,
  actionLabel,
  actionVariant = "primary",
  onConfirm,
}: CatalogActionDialogProps) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = reason.trim();
    if (!trimmed) {
      setError("Vui lòng nhập lý do thực hiện thao tác (bắt buộc cho kiểm toán)");
      return;
    }
    if (trimmed.length > 500) {
      setError("Lý do không được vượt quá 500 ký tự");
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await onConfirm(trimmed);
      if (result.success) {
        setReason("");
        onClose();
      } else {
        setError(result.message || "Có lỗi xảy ra khi thực hiện thao tác");
      }
    });
  };

  const getButtonClass = () => {
    switch (actionVariant) {
      case "danger":
        return "bg-rose-600 hover:bg-rose-700 text-white";
      case "warning":
        return "bg-amber-600 hover:bg-amber-700 text-white";
      case "primary":
      default:
        return "bg-emerald-600 hover:bg-emerald-700 text-white";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900 dark:border dark:border-slate-800">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{description}</p>

        <form onSubmit={handleSubmit} className="mt-4">
          <div>
            <label
              htmlFor="action-reason"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Lý do thực hiện <span className="text-rose-500">*</span>
            </label>
            <textarea
              id="action-reason"
              rows={3}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Nhập lý do cho nhật ký kiểm toán (bắt buộc)..."
              disabled={isPending}
              maxLength={500}
              className="mt-1 block w-full rounded-xl border border-slate-300 p-2.5 text-sm placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
            <div className="mt-1 flex justify-between text-xs text-slate-400">
              <span>{error ? <span className="text-rose-500">{error}</span> : "1-500 ký tự"}</span>
              <span>{reason.length}/500</span>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3">
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
              disabled={isPending || !reason.trim()}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition disabled:opacity-50 ${getButtonClass()}`}
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
              {actionLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
