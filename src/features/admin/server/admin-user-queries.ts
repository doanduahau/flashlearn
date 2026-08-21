import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type AdminUserRole = {
  role: string;
  granted_at: string;
};

export type EntitlementLimitItem = {
  key: string;
  label: string;
  description: string;
  valueType: "integer" | "boolean" | "text";
  baseValue: number | boolean | string | null;
  effectiveValue: number | boolean | string | null;
  isOverridden: boolean;
  overrideId?: string;
  overrideExpiresAt?: string | null;
  overrideUpdatedAtRaw?: string | null;
  overrideReason?: string | null;
};

export type UsageMeterItem = {
  key: string;
  label: string;
  consumed: number;
  limit: number;
  unit: string;
  periodKind: string;
  periodStart: string;
  periodEnd: string;
};

export type UserAuditItem = {
  id: string;
  action: string;
  actor: string;
  reason: string;
  afterSummary: Record<string, unknown> | null;
  createdAt: string;
};

export type AdminUserDetailData = {
  profile: {
    id: string;
    displayName: string | null;
    avatarUrl: string | null;
    timezone: string | null;
    createdAt: string;
    email?: string;
    emailConfirmedAt?: string | null;
  };
  roles: AdminUserRole[];
  plan: {
    id: string;
    label: string;
    isPro: boolean;
  };
  stats: {
    setCount: number;
    cardCount: number;
  };
  limits: EntitlementLimitItem[];
  usageMeters: UsageMeterItem[];
  auditLogs: UserAuditItem[];
};

const ENTITLEMENT_METADATA: Record<string, { label: string; description: string; unit?: string }> =
  {
    "sets.regular.max": {
      label: "Số bộ flashcard tối đa",
      description: "Giới hạn số lượng bộ flashcard người dùng có thể tạo",
      unit: "bộ",
    },
    "cards.total.max": {
      label: "Tổng số thẻ tối đa",
      description: "Giới hạn tổng số thẻ flashcard trên toàn bộ tài khoản",
      unit: "thẻ",
    },
    "collections.max": {
      label: "Số bộ đặc biệt tối đa",
      description: "Giới hạn số lượng bộ sưu tập đặc biệt (yêu thích, khó nhớ...)",
      unit: "bộ",
    },
    "card.side_chars.soft_max": {
      label: "Số ký tự tối đa mỗi mặt thẻ",
      description: "Độ dài ký tự tối đa cho mặt trước và mặt sau của thẻ",
      unit: "ký tự",
    },
    "ai.content_credits.monthly": {
      label: "Lượt tạo nội dung bằng AI / tháng",
      description: "Hạn ngạch tạo flashcard tự động bằng AI mỗi tháng",
      unit: "lượt",
    },
    "ai.typing_reviews.monthly": {
      label: "Lượt chấm gõ chữ AI / tháng",
      description: "Hạn ngạch chấm bài kiểm tra gõ chữ bằng AI",
      unit: "lượt",
    },
    "documents.heavy_jobs.monthly": {
      label: "Tác vụ xử lý tài liệu nặng / tháng",
      description: "Số lượt import tài liệu dung lượng lớn mỗi tháng",
      unit: "lượt",
    },
    "documents.heavy_jobs.rolling_day": {
      label: "Tác vụ tài liệu nặng / ngày",
      description: "Giới hạn burst tác vụ nặng trong 24 giờ",
      unit: "lượt",
    },
    "jobs.heavy.concurrent": {
      label: "Tác vụ nặng đồng thời",
      description: "Số lượng tác vụ nền nặng được chạy song song",
      unit: "tác vụ",
    },
    "storage.bytes": {
      label: "Dung lượng lưu trữ",
      description: "Tổng dung lượng lưu trữ tệp đính kèm và tài liệu",
      unit: "bytes",
    },
  };

export async function getAdminUserDetail(userId: string): Promise<AdminUserDetailData | null> {
  const admin = createAdminClient();

  // 1. Profile & Auth
  const { data: profile } = await admin
    .from("profiles")
    .select("id, display_name, avatar_url, timezone, created_at")
    .eq("id", userId)
    .maybeSingle();

  if (!profile) return null;

  const { data: authUser } = await admin.auth.admin.getUserById(userId);

  // 2. Roles
  const { data: rolesData } = await admin.rpc("get_effective_admin_roles", {
    p_user_id: userId,
  });

  const roles: AdminUserRole[] = (rolesData ?? []).map((r) => ({
    role: r.role,
    granted_at: r.granted_at,
  }));

  // 3. Plan
  const { data: planData } = await admin.rpc("get_effective_plan", {
    p_user_id: userId,
  });
  const planId = planData ?? "free";
  const isPro = planId.startsWith("pro_");
  const planLabel =
    planId === "pro_yearly"
      ? "Pro (Hàng năm)"
      : planId === "pro_monthly"
        ? "Pro (Hàng tháng)"
        : "Free (Miễn phí)";

  // 4. Stats
  const { count: setCount } = await admin
    .from("flashcard_sets")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  const { count: cardCount } = await admin
    .from("flashcards")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  // 5. Baseline Plan Entitlements
  const { data: baseEntitlements } = await admin
    .from("plan_entitlements")
    .select("entitlement_key, value_type, integer_value, boolean_value, text_value")
    .eq("plan_id", planId);

  // 6. Active Overrides with raw updated_at
  const { data: activeOverrides } = await admin
    .from("entitlement_overrides")
    .select(
      "id, entitlement_key, value_type, integer_value, boolean_value, text_value, reason, expires_at, updated_at",
    )
    .eq("user_id", userId)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

  const overrideMap = new Map<
    string,
    {
      id: string;
      value_type: string;
      integer_value: number | null;
      boolean_value: boolean | null;
      text_value: string | null;
      reason: string;
      expires_at: string | null;
      updated_at: string;
    }
  >();

  for (const o of activeOverrides ?? []) {
    overrideMap.set(o.entitlement_key, o);
  }

  // 7. Assemble Limits
  const limits: EntitlementLimitItem[] = (baseEntitlements ?? []).map((b) => {
    const meta = ENTITLEMENT_METADATA[b.entitlement_key] ?? {
      label: b.entitlement_key,
      description: "Quyền lợi hệ thống",
    };

    const override = overrideMap.get(b.entitlement_key);
    const isOverridden = !!override;

    let baseVal: number | boolean | string | null = null;
    if (b.value_type === "integer") baseVal = b.integer_value;
    else if (b.value_type === "boolean") baseVal = b.boolean_value;
    else if (b.value_type === "text") baseVal = b.text_value;

    let effVal = baseVal;
    if (override) {
      if (override.value_type === "integer") effVal = override.integer_value;
      else if (override.value_type === "boolean") effVal = override.boolean_value;
      else if (override.value_type === "text") effVal = override.text_value;
    }

    return {
      key: b.entitlement_key,
      label: meta.label,
      description: meta.description,
      valueType: b.value_type as "integer" | "boolean" | "text",
      baseValue: baseVal,
      effectiveValue: effVal,
      isOverridden,
      overrideId: override?.id,
      overrideExpiresAt: override?.expires_at,
      overrideUpdatedAtRaw: override?.updated_at,
      overrideReason: override?.reason,
    };
  });

  // 8. Usage Balances for key meters
  const meterKeys = [
    "ai.content_credits.monthly",
    "ai.typing_reviews.monthly",
    "documents.heavy_jobs.rolling_day",
  ];
  const usageMeters: UsageMeterItem[] = [];

  for (const mKey of meterKeys) {
    const isRolling = mKey === "documents.heavy_jobs.rolling_day";
    const periodKind = isRolling ? "rolling_day" : "calendar_month";

    const { data: periodRow } = await admin
      .from("usage_periods")
      .select("id, period_start, period_end")
      .eq("user_id", userId)
      .eq("usage_key", mKey)
      .eq("period_kind", periodKind)
      .order("period_start", { ascending: false })
      .limit(1)
      .maybeSingle();

    let consumed = 0;
    if (isRolling) {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: ledgerRows } = await admin
        .from("usage_ledger")
        .select("amount, entry_type")
        .eq("user_id", userId)
        .eq("usage_key", mKey)
        .gt("created_at", since);

      for (const row of ledgerRows ?? []) {
        consumed += row.entry_type === "credit" ? -row.amount : row.amount;
      }
    } else if (periodRow?.id) {
      const { data: ledgerRows } = await admin
        .from("usage_ledger")
        .select("amount, entry_type")
        .eq("period_id", periodRow.id);

      for (const row of ledgerRows ?? []) {
        consumed += row.entry_type === "credit" ? -row.amount : row.amount;
      }
    }

    const limitItem = limits.find((l) => l.key === mKey);
    const limitVal = typeof limitItem?.effectiveValue === "number" ? limitItem.effectiveValue : 0;
    const meta = ENTITLEMENT_METADATA[mKey];

    usageMeters.push({
      key: mKey,
      label: meta?.label ?? mKey,
      consumed: Math.max(0, consumed),
      limit: limitVal,
      unit: meta?.unit ?? "lượt",
      periodKind,
      periodStart: periodRow?.period_start ?? new Date().toISOString(),
      periodEnd: periodRow?.period_end ?? new Date().toISOString(),
    });
  }

  // 9. Recent Audit History for this user
  const { data: auditRows } = await admin
    .from("admin_audit_logs")
    .select("id, action, actor, reason, after_summary, created_at")
    .eq("target_type", "user")
    .eq("target_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  const auditLogs: UserAuditItem[] = (auditRows ?? []).map((a) => ({
    id: a.id,
    action: a.action,
    actor: a.actor ?? "system",
    reason: a.reason ?? "",
    afterSummary: a.after_summary as Record<string, unknown> | null,
    createdAt: a.created_at,
  }));

  return {
    profile: {
      id: profile.id,
      displayName: profile.display_name,
      avatarUrl: profile.avatar_url,
      timezone: profile.timezone,
      createdAt: profile.created_at,
      email: authUser?.user?.email,
      emailConfirmedAt: authUser?.user?.email_confirmed_at,
    },
    roles,
    plan: {
      id: planId,
      label: planLabel,
      isPro,
    },
    stats: {
      setCount: setCount ?? 0,
      cardCount: cardCount ?? 0,
    },
    limits,
    usageMeters,
    auditLogs,
  };
}
