"use client";

import { useState, useTransition } from "react";

import { adminAdjustUserUsage } from "@/features/admin/server/admin-user-actions";

type AdjustmentType = "usage" | "entitlement";

export function UserAdjustmentPanel({
  targetUserId,
}: Readonly<{
  targetUserId: string;
}>) {
  const [type, setType] = useState<AdjustmentType>("usage");
  const [usageKey, setUsageKey] = useState("ai.content_credits.monthly");
  const [amount, setAmount] = useState(10);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleAdjust() {
    if (!reason.trim()) return;
    setMessage(null);
    startTransition(async () => {
      try {
        if (type === "usage") {
          const result = await adminAdjustUserUsage(targetUserId, usageKey, amount, reason.trim());
          if (result.ok) {
            setMessage({
              type: "success",
              text: `Đã điều chỉnh usage: ${usageKey} ${amount > 0 ? "+" : ""}${amount}.`,
            });
          } else {
            setMessage({ type: "error", text: result.error });
          }
        }
        setReason("");
      } catch {
        setMessage({ type: "error", text: "Lỗi không xác định." });
      }
    });
  }

  return (
    <section className="rounded-2xl border border-border-soft bg-surface p-4 shadow-soft-card sm:rounded-3xl sm:p-6">
      <h2 className="text-base font-bold sm:text-lg">Điều chỉnh</h2>

      {message && (
        <div
          role="status"
          className={`mt-3 rounded-xl border p-3 text-sm ${
            message.type === "success"
              ? "border-success/30 bg-success/5 text-success"
              : "border-danger/30 bg-danger/5 text-danger"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="mt-3 flex flex-col gap-3">
        {/* Type toggle */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setType("usage")}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
              type === "usage"
                ? "bg-primary text-primary-foreground"
                : "bg-surface-subtle text-text-secondary"
            }`}
          >
            Usage
          </button>
          <button
            type="button"
            disabled
            className="rounded-lg bg-surface-subtle px-3 py-1.5 text-xs font-medium text-text-secondary opacity-50"
          >
            Entitlement (sớm)
          </button>
        </div>

        {/* Usage adjustment form */}
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="usage-key" className="text-xs text-text-secondary">
              Usage Key
            </label>
            <select
              id="usage-key"
              value={usageKey}
              onChange={(e) => setUsageKey(e.target.value)}
              className="rounded-xl border border-border-soft bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
            >
              <option value="ai.content_credits.monthly">AI Content Credits (monthly)</option>
              <option value="ai.typing_reviews.monthly">AI Typing Reviews (monthly)</option>
              <option value="documents.heavy_jobs.monthly">Documents Heavy Jobs (monthly)</option>
              <option value="documents.heavy_jobs.rolling_day">
                Documents Heavy Jobs (rolling day)
              </option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="usage-amount" className="text-xs text-text-secondary">
              Số lượng (-10000 đến 10000)
            </label>
            <input
              id="usage-amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              min={-10000}
              max={10000}
              className="rounded-xl border border-border-soft bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="adjust-reason" className="text-xs text-text-secondary">
              Lý do
            </label>
            <input
              id="adjust-reason"
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Lý do điều chỉnh..."
              className="rounded-xl border border-border-soft bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
          <button
            type="button"
            disabled={isPending || !reason.trim()}
            onClick={handleAdjust}
            className="self-start rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
          >
            {isPending ? "Đang xử lý..." : "Điều chỉnh"}
          </button>
        </div>
      </div>
    </section>
  );
}
