"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { grantRoleAction, revokeRoleAction } from "@/features/admin/server/role-actions";
import { ADMIN_ROLES, ROLE_PERMISSIONS, type AdminRole } from "@/features/admin/role-constants";

type RoleRow = {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
  display_name: string;
};

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  content_admin: "Content Admin",
  support: "Support",
  analyst: "Analyst",
};

export function RoleManagementPanel({ roles }: Readonly<{ roles: RoleRow[] }>) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Grant dialog
  const [grantOpen, setGrantOpen] = useState(false);
  const [grantTarget, setGrantTarget] = useState("");
  const [grantRole, setGrantRole] = useState<AdminRole | "">("");
  const [grantReason, setGrantReason] = useState("");

  // Revoke dialog
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState("");
  const [revokeRole, setRevokeRole] = useState("");
  const [revokeReason, setRevokeReason] = useState("");

  // Lookup dialog
  const [lookupOpen, setLookupOpen] = useState(false);
  const [lookupQuery, setLookupQuery] = useState("");
  const [lookupResult, setLookupResult] = useState<{
    id: string;
    display_name: string;
    email: string;
    roles: string[];
  } | null>(null);
  const [lookupPending, setLookupPending] = useState(false);

  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  async function handleLookup() {
    if (!lookupQuery.trim()) return;
    setLookupPending(true);
    setLookupResult(null);
    try {
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lookupQuery.trim());
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        lookupQuery.trim(),
      );

      if (!isEmail && !isUuid) {
        setLookupResult(null);
        setLookupPending(false);
        return;
      }

      // Use the lookup result from the server-rendered data
      // For now, we'll use a simple approach
      const response = await fetch("/api/admin/lookup-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: lookupQuery.trim() }),
      });

      if (response.ok) {
        const data = await response.json();
        setLookupResult(data);
      }
    } catch {
      // Ignore fetch errors
    } finally {
      setLookupPending(false);
    }
  }

  function handleGrant() {
    clearMessages();
    startTransition(async () => {
      const result = await grantRoleAction(grantTarget, grantRole as string, grantReason);
      if (result && !result.ok) {
        setError(result.error);
      } else {
        setSuccess(`Đã cấp vai trò ${ROLE_LABELS[grantRole] ?? grantRole}.`);
        setGrantOpen(false);
        setGrantTarget("");
        setGrantRole("");
        setGrantReason("");
        router.refresh();
      }
    });
  }

  function handleRevoke() {
    clearMessages();
    startTransition(async () => {
      const result = await revokeRoleAction(revokeTarget, revokeRole, revokeReason);
      if (result && !result.ok) {
        setError(result.error);
      } else {
        setSuccess(`Đã thu hồi vai trò ${ROLE_LABELS[revokeRole] ?? revokeRole}.`);
        setRevokeOpen(false);
        setRevokeTarget("");
        setRevokeRole("");
        setRevokeReason("");
        router.refresh();
      }
    });
  }

  // Group roles by user
  const userRoles = new Map<string, RoleRow[]>();
  for (const r of roles) {
    const existing = userRoles.get(r.user_id) ?? [];
    existing.push(r);
    userRoles.set(r.user_id, existing);
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-danger/20 bg-danger/5 p-3 text-sm text-danger"
        >
          {error}
        </div>
      )}
      {success && (
        <div
          role="status"
          className="rounded-xl border border-success/20 bg-success/5 p-3 text-sm text-success"
        >
          {success}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setGrantOpen(true)}>Cấp vai trò</Button>
        <Button variant="outline" onClick={() => setRevokeOpen(true)}>
          Thu hồi vai trò
        </Button>
        <Button variant="outline" onClick={() => setLookupOpen(true)}>
          Tra cứu người dùng
        </Button>
      </div>

      {/* Current roles */}
      <div className="rounded-2xl border border-border-soft bg-surface p-4 shadow-soft-card sm:rounded-3xl sm:p-6">
        <h2 className="text-base font-bold sm:text-lg">Vai trò hiện tại</h2>
        {roles.length === 0 ? (
          <p className="mt-3 text-sm text-text-secondary">Chưa có vai trò quản trị nào.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {[...userRoles.entries()].map(([userId, userRoleList]) => (
              <div
                key={userId}
                className="rounded-xl border border-border-soft bg-surface-subtle p-3"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{userRoleList[0].display_name}</span>
                  <span className="font-mono text-xs text-text-secondary">
                    {userId.slice(0, 8)}…
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {userRoleList.map((r) => (
                    <span
                      key={r.id}
                      className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-medium text-primary-foreground"
                    >
                      {ROLE_LABELS[r.role] ?? r.role}
                      <span className="text-primary-foreground/60">
                        since {new Date(r.created_at).toLocaleDateString("vi-VN")}
                      </span>
                    </span>
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {userRoleList.map((r) =>
                    (ROLE_PERMISSIONS[r.role as AdminRole] ?? []).map((p) => (
                      <span
                        key={`${r.id}-${p}`}
                        className="rounded-md border border-border-soft bg-surface px-1.5 py-0.5 text-[10px] text-text-secondary"
                      >
                        {p}
                      </span>
                    )),
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Permission reference */}
      <div className="rounded-2xl border border-border-soft bg-surface p-4 shadow-soft-card sm:rounded-3xl sm:p-6">
        <h2 className="text-base font-bold sm:text-lg">Tham chiếu quyền</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border-soft text-text-secondary">
                <th className="px-2 py-1.5">Vai trò</th>
                <th className="px-2 py-1.5">Quyền</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-soft">
              {ADMIN_ROLES.map((role) => (
                <tr key={role}>
                  <td className="px-2 py-1.5 font-medium">{ROLE_LABELS[role]}</td>
                  <td className="px-2 py-1.5">
                    <div className="flex flex-wrap gap-1">
                      {ROLE_PERMISSIONS[role].map((p) => (
                        <span
                          key={p}
                          className="rounded bg-surface-subtle px-1 py-0.5 text-text-secondary"
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Grant Dialog */}
      <Dialog open={grantOpen} onOpenChange={setGrantOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cấp vai trò quản trị</DialogTitle>
            <DialogDescription>Nhập ID người dùng và chọn vai trò. Cần lý do.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="grant-target">User ID *</Label>
              <Input
                id="grant-target"
                value={grantTarget}
                onChange={(e) => setGrantTarget(e.target.value)}
                placeholder="uuid..."
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="grant-role">Vai trò *</Label>
              <Select value={grantRole} onValueChange={(v) => setGrantRole(v as AdminRole)}>
                <SelectTrigger id="grant-role">
                  <SelectValue placeholder="Chọn vai trò" />
                </SelectTrigger>
                <SelectContent>
                  {ADMIN_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="grant-reason">Lý do *</Label>
              <Input
                id="grant-reason"
                value={grantReason}
                onChange={(e) => setGrantReason(e.target.value)}
                placeholder="Lý do cấp vai trò..."
                required
                maxLength={500}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGrantOpen(false)} disabled={pending}>
              Hủy
            </Button>
            <Button
              onClick={handleGrant}
              disabled={pending || !grantTarget || !grantRole || !grantReason}
            >
              {pending ? "Đang cấp..." : "Cấp vai trò"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Dialog */}
      <Dialog open={revokeOpen} onOpenChange={setRevokeOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Thu hồi vai trò</DialogTitle>
            <DialogDescription>
              Chọn người dùng và vai trò cần thu hồi. Không thể thu hồi owner cuối cùng.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="revoke-target">User ID *</Label>
              <Input
                id="revoke-target"
                value={revokeTarget}
                onChange={(e) => setRevokeTarget(e.target.value)}
                placeholder="uuid..."
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="revoke-role">Vai trò cần thu hồi *</Label>
              <Select value={revokeRole} onValueChange={setRevokeRole}>
                <SelectTrigger id="revoke-role">
                  <SelectValue placeholder="Chọn vai trò" />
                </SelectTrigger>
                <SelectContent>
                  {ADMIN_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="revoke-reason">Lý do *</Label>
              <Input
                id="revoke-reason"
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                placeholder="Lý do thu hồi..."
                required
                maxLength={500}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeOpen(false)} disabled={pending}>
              Hủy
            </Button>
            <Button
              variant="destructive"
              onClick={handleRevoke}
              disabled={pending || !revokeTarget || !revokeRole || !revokeReason}
            >
              {pending ? "Đang thu hồi..." : "Thu hồi vai trò"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lookup Dialog */}
      <Dialog open={lookupOpen} onOpenChange={setLookupOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tra cứu người dùng</DialogTitle>
            <DialogDescription>Nhập email hoặc UUID để xem thông tin và vai trò.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="flex gap-2">
              <Input
                value={lookupQuery}
                onChange={(e) => setLookupQuery(e.target.value)}
                placeholder="user@example.com hoặc uuid..."
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleLookup();
                }}
              />
              <Button onClick={handleLookup} disabled={lookupPending || !lookupQuery.trim()}>
                {lookupPending ? "..." : "Tìm"}
              </Button>
            </div>
            {lookupResult && (
              <div className="rounded-xl border border-border-soft bg-surface-subtle p-3 text-sm">
                <p className="font-medium">{lookupResult.display_name}</p>
                <p className="text-xs text-text-secondary">{lookupResult.email}</p>
                <p className="mt-1 font-mono text-xs">ID: {lookupResult.id}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {lookupResult.roles.length > 0 ? (
                    lookupResult.roles.map((r) => (
                      <span
                        key={r}
                        className="rounded-full bg-primary-soft px-2 py-0.5 text-xs text-primary-foreground"
                      >
                        {ROLE_LABELS[r] ?? r}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-text-secondary">Không có vai trò quản trị</span>
                  )}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLookupOpen(false)}>
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
