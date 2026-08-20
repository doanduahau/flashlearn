"use client";

import { useState, useTransition } from "react";

import { grantRoleAction, revokeRoleAction } from "@/features/admin/server/role-actions";
import { ADMIN_ROLES, ROLE_LABELS } from "@/features/admin/role-constants";

type EnrichedRole = {
  id: string;
  user_id: string;
  role: string;
  display_name: string;
  created_at: string;
};

export function RoleManagementPanel({
  roles,
}: Readonly<{
  roles: EnrichedRole[];
}>) {
  const [lookupId, setLookupId] = useState("");
  const [grantRole, setGrantRole] = useState<string>(ADMIN_ROLES[0]);
  const [grantReason, setGrantReason] = useState("");
  const [revokeTarget, setRevokeTarget] = useState("");
  const [revokeReason, setRevokeReason] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleGrant() {
    if (!lookupId.trim() || !grantReason.trim()) return;
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await grantRoleAction(lookupId.trim(), grantRole, grantReason.trim());
        if (result.ok) {
          setMessage({ type: "success", text: `Đã cấp vai trò ${result.role} thành công.` });
        } else {
          setMessage({ type: "error", text: result.error });
        }
        setLookupId("");
        setGrantReason("");
      } catch (error) {
        setMessage({
          type: "error",
          text: error instanceof Error ? error.message : "Không thể cấp vai trò.",
        });
      }
    });
  }

  function handleRevoke(targetUserId: string, role: string) {
    if (!revokeReason.trim()) return;
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await revokeRoleAction(targetUserId, role, revokeReason.trim());
        if (result.ok) {
          setMessage({
            type: "success",
            text: `Đã thu hồi vai trò ${result.role}${result.revokedAt ? " (lúc " + new Date(result.revokedAt).toLocaleString("vi-VN") + ")" : ""}.`,
          });
        } else {
          setMessage({ type: "error", text: result.error });
        }
        setRevokeTarget("");
        setRevokeReason("");
      } catch (error) {
        setMessage({
          type: "error",
          text: error instanceof Error ? error.message : "Không thể thu hồi vai trò.",
        });
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Message */}
      {message && (
        <div
          role="status"
          className={`rounded-2xl border p-4 text-sm ${
            message.type === "success"
              ? "border-success/30 bg-success/5 text-success"
              : "border-danger/30 bg-danger/5 text-danger"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Grant role form */}
      <section className="rounded-2xl border border-border-soft bg-surface p-4 shadow-soft-card sm:rounded-3xl sm:p-6">
        <h2 className="text-base font-bold sm:text-lg">Cấp vai trò</h2>
        <div className="mt-3 flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="grant-user-id" className="text-xs text-text-secondary">
              User ID
            </label>
            <input
              id="grant-user-id"
              type="text"
              value={lookupId}
              onChange={(e) => setLookupId(e.target.value)}
              placeholder="UUID của người dùng..."
              className="rounded-xl border border-border-soft bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="grant-role" className="text-xs text-text-secondary">
              Vai trò
            </label>
            <select
              id="grant-role"
              value={grantRole}
              onChange={(e) => setGrantRole(e.target.value)}
              className="rounded-xl border border-border-soft bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
            >
              {ADMIN_ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role as keyof typeof ROLE_LABELS] ?? role}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="grant-reason" className="text-xs text-text-secondary">
              Lý do
            </label>
            <input
              id="grant-reason"
              type="text"
              value={grantReason}
              onChange={(e) => setGrantReason(e.target.value)}
              placeholder="Lý do cấp vai trò..."
              className="rounded-xl border border-border-soft bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
          <button
            type="button"
            disabled={isPending || !lookupId.trim() || !grantReason.trim()}
            onClick={handleGrant}
            className="self-start rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
          >
            {isPending ? "Đang xử lý..." : "Cấp vai trò"}
          </button>
        </div>
      </section>

      {/* Revoke role form */}
      <section className="rounded-2xl border border-border-soft bg-surface p-4 shadow-soft-card sm:rounded-3xl sm:p-6">
        <h2 className="text-base font-bold sm:text-lg">Thu hồi vai trò</h2>
        <div className="mt-3 flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="revoke-user-id" className="text-xs text-text-secondary">
              User ID
            </label>
            <input
              id="revoke-user-id"
              type="text"
              value={revokeTarget}
              onChange={(e) => setRevokeTarget(e.target.value)}
              placeholder="UUID của người dùng..."
              className="rounded-xl border border-border-soft bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="revoke-reason" className="text-xs text-text-secondary">
              Lý do
            </label>
            <input
              id="revoke-reason"
              type="text"
              value={revokeReason}
              onChange={(e) => setRevokeReason(e.target.value)}
              placeholder="Lý do thu hồi..."
              className="rounded-xl border border-border-soft bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
          <button
            type="button"
            disabled={isPending || !revokeTarget.trim() || !revokeReason.trim()}
            onClick={() => handleRevoke(revokeTarget.trim(), grantRole)}
            className="self-start rounded-xl border border-danger/30 bg-danger/5 px-4 py-2 text-sm font-medium text-danger hover:bg-danger/10 disabled:opacity-50"
          >
            {isPending ? "Đang xử lý..." : "Thu hồi vai trò"}
          </button>
        </div>
      </section>

      {/* Active roles list */}
      <section className="rounded-2xl border border-border-soft bg-surface p-4 shadow-soft-card sm:rounded-3xl sm:p-6">
        <h2 className="text-base font-bold sm:text-lg">Vai trò đang active ({roles.length})</h2>
        {roles.length === 0 ? (
          <p className="mt-3 text-sm text-text-secondary">Chưa có vai trò nào.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr className="border-b border-border-soft text-xs uppercase tracking-wide text-text-secondary">
                  <th className="px-3 py-2">Người dùng</th>
                  <th className="px-3 py-2">User ID</th>
                  <th className="px-3 py-2">Vai trò</th>
                  <th className="px-3 py-2">Cấp lúc</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-soft">
                {roles.map((r) => (
                  <tr key={r.id} className="hover:bg-surface-subtle">
                    <td className="px-3 py-2 text-sm">{r.display_name}</td>
                    <td className="px-3 py-2 font-mono text-xs text-text-secondary">
                      {r.user_id.slice(0, 8)}…
                    </td>
                    <td className="px-3 py-2">
                      <span className="inline-flex rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-medium text-primary-foreground">
                        {ROLE_LABELS[r.role as keyof typeof ROLE_LABELS] ?? r.role}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-text-secondary">
                      {new Date(r.created_at).toLocaleDateString("vi-VN")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
