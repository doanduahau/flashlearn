"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { EntitlementOverrideModal } from "@/features/admin/components/users/entitlement-override-modal";
import { EntitlementRemoveModal } from "@/features/admin/components/users/entitlement-remove-modal";
import { UsageAdjustModal } from "@/features/admin/components/users/usage-adjust-modal";
import { UserAuditHistory } from "@/features/admin/components/users/user-audit-history";
import { UserLimitsCard } from "@/features/admin/components/users/user-limits-card";
import { UserProfileCard } from "@/features/admin/components/users/user-profile-card";
import { UserUsageCard } from "@/features/admin/components/users/user-usage-card";
import type {
  AdminUserDetailData,
  EntitlementLimitItem,
  UsageMeterItem,
} from "@/features/admin/server/admin-user-queries";

export interface UserDetailManagerProps {
  user: AdminUserDetailData;
  isOwner: boolean;
  mutationsEnabled: boolean;
  isSelf: boolean;
}

export function UserDetailManager({
  user,
  isOwner,
  mutationsEnabled,
  isSelf,
}: UserDetailManagerProps) {
  const router = useRouter();
  const [selectedMeter, setSelectedMeter] = useState<UsageMeterItem | null>(null);
  const [selectedOverrideItem, setSelectedOverrideItem] = useState<EntitlementLimitItem | null>(
    null,
  );
  const [selectedRemoveItem, setSelectedRemoveItem] = useState<EntitlementLimitItem | null>(null);

  const canMutate = isOwner && mutationsEnabled && !isSelf;

  const handleRefresh = () => {
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Breadcrumb */}
      <div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Link href="/admin/users" className="hover:text-slate-800 dark:hover:text-slate-200">
            ← Danh sách người dùng
          </Link>
          <span>/</span>
          <span className="font-medium text-slate-700 dark:text-slate-300">
            {user.profile.displayName || user.profile.email || user.profile.id}
          </span>
        </div>

        <div className="mt-3 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Chi tiết & Quản trị tài khoản
            </h1>
            <p className="text-xs text-slate-500">
              Quản lý thông tin, theo dõi sử dụng và cấu hình quyền lợi riêng cho tài khoản này.
            </p>
          </div>

          {!mutationsEnabled && (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
              Chế độ chỉ đọc (Mutations Disabled)
            </span>
          )}

          {isSelf && (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
              Tài khoản của chính bạn (Không thể tự chỉnh sửa)
            </span>
          )}
        </div>
      </div>

      {/* 1. User Profile & Stats */}
      <UserProfileCard user={user} />

      {/* 2. Usage Balances & Adjustments */}
      <UserUsageCard
        usageMeters={user.usageMeters}
        canMutate={canMutate}
        onOpenAdjustModal={(meter) => setSelectedMeter(meter)}
      />

      {/* 3. Entitlement Limits & Overrides */}
      <UserLimitsCard
        limits={user.limits}
        planLabel={user.plan.label}
        canMutate={canMutate}
        onOpenOverrideModal={(item) => setSelectedOverrideItem(item)}
        onOpenRemoveModal={(item) => setSelectedRemoveItem(item)}
      />

      {/* 4. Audit Trail */}
      <UserAuditHistory auditLogs={user.auditLogs} />

      {/* Modals */}
      <UsageAdjustModal
        isOpen={!!selectedMeter}
        onClose={() => setSelectedMeter(null)}
        targetUserId={user.profile.id}
        targetUserEmail={user.profile.email || user.profile.id}
        targetUserName={user.profile.displayName || user.profile.email || "Người dùng"}
        meter={selectedMeter}
        onSuccess={handleRefresh}
      />

      <EntitlementOverrideModal
        isOpen={!!selectedOverrideItem}
        onClose={() => setSelectedOverrideItem(null)}
        targetUserId={user.profile.id}
        targetUserEmail={user.profile.email || user.profile.id}
        targetUserName={user.profile.displayName || user.profile.email || "Người dùng"}
        planLabel={user.plan.label}
        limitItem={selectedOverrideItem}
        onSuccess={handleRefresh}
      />

      <EntitlementRemoveModal
        isOpen={!!selectedRemoveItem}
        onClose={() => setSelectedRemoveItem(null)}
        targetUserId={user.profile.id}
        targetUserEmail={user.profile.email || user.profile.id}
        targetUserName={user.profile.displayName || user.profile.email || "Người dùng"}
        planLabel={user.plan.label}
        limitItem={selectedRemoveItem}
        onSuccess={handleRefresh}
      />
    </div>
  );
}
