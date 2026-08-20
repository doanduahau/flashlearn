"use server";

import { revalidatePath } from "next/cache";

import {
  AdminAuthorizationError,
  requireAdminPermission,
} from "@/features/admin/server/authorization";
import { createAdminClient } from "@/lib/supabase/admin";

export type UserMutationResult =
  { ok: true; [key: string]: unknown } | { ok: false; error: string };

function adminError(message: string): UserMutationResult {
  return { ok: false, error: message };
}

/**
 * Adjust user usage by a bounded amount. Append-only ledger entry.
 * Requires: usage.adjust permission (support, owner).
 */
export async function adminAdjustUserUsage(
  targetUserId: string,
  usageKey: string,
  amount: number,
  reason: string,
  correlationId?: string,
): Promise<UserMutationResult> {
  try {
    const identity = await requireAdminPermission("usage.adjust");
    const admin = createAdminClient();

    const { data, error } = await admin.rpc("admin_adjust_user_usage", {
      p_actor_user_id: identity.userId,
      p_target_user_id: targetUserId,
      p_usage_key: usageKey,
      p_amount: amount,
      p_reason: reason,
      ...(correlationId && { p_correlation_id: correlationId }),
    });

    if (error) {
      const msg = error.message;
      if (msg.includes("amount must be"))
        return adminError("Số tiền điều chỉnh phải nằm trong khoảng -10000 đến 10000.");
      if (msg.includes("reason required")) return adminError("Vui lòng nhập lý do.");
      return adminError(`Không thể điều chỉnh: ${msg}`);
    }

    revalidatePath("/admin/users");
    return { ok: true, usage_key: data?.[0]?.usage_key, amount: data?.[0]?.amount };
  } catch (error) {
    if (error instanceof AdminAuthorizationError)
      return adminError("Không có quyền điều chỉnh usage.");
    return adminError("Lỗi server khi điều chỉnh usage.");
  }
}

/**
 * Override user entitlement with bounded value and mandatory expiry.
 * Requires: subscriptions.override permission (support, owner).
 */
export async function adminOverrideEntitlement(
  targetUserId: string,
  entitlementKey: string,
  valueType: "integer" | "boolean" | "text",
  value: { integer_value?: number; boolean_value?: boolean; text_value?: string },
  expiresAt: string,
  reason: string,
  correlationId?: string,
): Promise<UserMutationResult> {
  try {
    const identity = await requireAdminPermission("subscriptions.override");
    const admin = createAdminClient();

    const { data, error } = await admin.rpc("admin_override_user_entitlement", {
      p_actor_user_id: identity.userId,
      p_target_user_id: targetUserId,
      p_entitlement_key: entitlementKey,
      p_value_type: valueType,
      p_reason: reason,
      ...(value.integer_value !== undefined && { p_integer_value: value.integer_value }),
      ...(value.boolean_value !== undefined && { p_boolean_value: value.boolean_value }),
      ...(value.text_value !== undefined && { p_text_value: value.text_value }),
      p_expires_at: expiresAt,
      ...(correlationId && { p_correlation_id: correlationId }),
    });

    if (error) {
      const msg = error.message;
      if (msg.includes("expiry required")) return adminError("Phải nhập thời hạn hết hiệu lực.");
      if (msg.includes("must be in the future")) return adminError("Thời hạn phải ở tương lai.");
      if (msg.includes("reason required")) return adminError("Vui lòng nhập lý do.");
      return adminError(`Không thể ghi đè entitlement: ${msg}`);
    }

    revalidatePath("/admin/users");
    return { ok: true, id: data?.[0]?.id, entitlement_key: data?.[0]?.entitlement_key };
  } catch (error) {
    if (error instanceof AdminAuthorizationError)
      return adminError("Không có quyền ghi đè entitlement.");
    return adminError("Lỗi server khi ghi đè entitlement.");
  }
}
