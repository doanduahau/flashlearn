"use client";

import { useState, useTransition } from "react";

import {
  adminPublishCatalogSet,
  adminUnpublishCatalogSet,
  adminArchiveCatalogSet,
} from "@/features/admin/server/admin-catalog-actions";

type CatalogStatus = "draft" | "published" | "archived";

export function CatalogActionsCell({
  setId,
  status,
}: Readonly<{
  setId: string;
  status: CatalogStatus;
}>) {
  const [confirmAction, setConfirmAction] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleAction(action: string) {
    if (!reason.trim()) return;
    setMessage(null);
    startTransition(async () => {
      try {
        let result;
        if (action === "publish") {
          result = await adminPublishCatalogSet(setId, reason.trim());
        } else if (action === "unpublish") {
          result = await adminUnpublishCatalogSet(setId, reason.trim());
        } else if (action === "archive") {
          result = await adminArchiveCatalogSet(setId, reason.trim());
        }
        if (result?.ok) {
          setMessage({ type: "success", text: `Thao tác "${action}" thành công.` });
        } else {
          setMessage({ type: "error", text: result?.error ?? "Không rõ lỗi." });
        }
        setConfirmAction(null);
        setReason("");
      } catch {
        setMessage({ type: "error", text: "Lỗi không xác định." });
      }
    });
  }

  if (confirmAction) {
    return (
      <div className="flex flex-col gap-2">
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Lý do..."
          className="rounded-lg border border-border-soft bg-surface px-2 py-1 text-xs outline-none focus:border-primary"
          autoFocus
        />
        <div className="flex gap-1">
          <button
            type="button"
            disabled={isPending || !reason.trim()}
            onClick={() => handleAction(confirmAction)}
            className="rounded-lg bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
          >
            {isPending ? "..." : "Xác nhận"}
          </button>
          <button
            type="button"
            onClick={() => {
              setConfirmAction(null);
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
    <div className="flex gap-1">
      {status === "draft" && (
        <button
          type="button"
          onClick={() => setConfirmAction("publish")}
          className="rounded-lg bg-success/10 px-2 py-1 text-xs font-medium text-success hover:bg-success/20"
        >
          Xuất bản
        </button>
      )}
      {status === "published" && (
        <button
          type="button"
          onClick={() => setConfirmAction("unpublish")}
          className="rounded-lg bg-warning/10 px-2 py-1 text-xs font-medium text-warning hover:bg-warning/20"
        >
          Hủy XB
        </button>
      )}
      {status !== "archived" && (
        <button
          type="button"
          onClick={() => setConfirmAction("archive")}
          className="rounded-lg bg-surface-subtle px-2 py-1 text-xs font-medium text-text-secondary hover:bg-border-soft"
        >
          Lưu trữ
        </button>
      )}
    </div>
  );
}
