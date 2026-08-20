"use client";

import { useState, useTransition } from "react";

import { adminRetryProcessingJob } from "@/features/admin/server/admin-job-actions";

export function JobRetryButton({
  jobId,
  status,
}: Readonly<{
  jobId: string;
  status: string;
}>) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  if (status !== "failed") return null;

  if (showConfirm) {
    return (
      <div className="flex flex-col gap-2">
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Lý do thử lại..."
          className="rounded-lg border border-border-soft bg-surface px-2 py-1 text-xs outline-none focus:border-primary"
          autoFocus
        />
        <div className="flex gap-1">
          <button
            type="button"
            disabled={isPending || !reason.trim()}
            onClick={() => {
              setMessage(null);
              startTransition(async () => {
                try {
                  const result = await adminRetryProcessingJob(jobId, reason.trim());
                  if (result.ok) {
                    setMessage({ type: "success", text: "Đã chuyển về hàng chờ." });
                  } else {
                    setMessage({ type: "error", text: result.error });
                  }
                  setShowConfirm(false);
                  setReason("");
                } catch {
                  setMessage({ type: "error", text: "Lỗi không xác định." });
                }
              });
            }}
            className="rounded-lg bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
          >
            {isPending ? "..." : "Thử lại"}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowConfirm(false);
              setReason("");
            }}
            className="rounded-lg border border-border-soft px-2 py-1 text-xs text-text-secondary hover:bg-surface-subtle"
          >
            Hủy
          </button>
        </div>
        {message && (
          <span className={`text-xs ${message.type === "error" ? "text-danger" : "text-success"}`}>
            {message.text}
          </span>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setShowConfirm(true)}
      className="rounded-lg bg-primary/10 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/20"
    >
      Thử lại
    </button>
  );
}
