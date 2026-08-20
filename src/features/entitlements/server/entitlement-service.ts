import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/types";
import { getFeatureFlags } from "@/lib/telemetry/feature-flags";
import { recordTelemetry } from "@/lib/telemetry/telemetry";

export type PlanId = "free" | "pro_monthly" | "pro_yearly";
export type QuotaEnforcementMode = "observe" | "warn" | "block";
export type UsageKey =
  | "ai.content_credits.monthly"
  | "ai.typing_reviews.monthly"
  | "documents.heavy_jobs.monthly"
  | "documents.heavy_jobs.rolling_day"
  | "jobs.heavy.concurrent";

type EntitlementValue = {
  source: "plan" | "override";
  value_type: "integer" | "boolean" | "text";
  integer_value: number | null;
  boolean_value: boolean | null;
  text_value: string | null;
};

function parseEntitlement(value: Json): EntitlementValue | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const entry = value as Record<string, Json | undefined>;
  if (
    (entry.source !== "plan" && entry.source !== "override") ||
    (entry.value_type !== "integer" &&
      entry.value_type !== "boolean" &&
      entry.value_type !== "text")
  ) {
    return null;
  }
  return {
    source: entry.source,
    value_type: entry.value_type,
    integer_value: typeof entry.integer_value === "number" ? entry.integer_value : null,
    boolean_value: typeof entry.boolean_value === "boolean" ? entry.boolean_value : null,
    text_value: typeof entry.text_value === "string" ? entry.text_value : null,
  };
}

export async function getEffectivePlan(userId: string): Promise<PlanId> {
  const { data, error } = await createAdminClient().rpc("get_effective_plan", {
    p_user_id: userId,
  });
  if (error || (data !== "free" && data !== "pro_monthly" && data !== "pro_yearly")) return "free";
  return data;
}

export async function getEntitlement(
  userId: string,
  key: string,
): Promise<EntitlementValue | null> {
  const { data, error } = await createAdminClient().rpc("get_effective_entitlement", {
    p_user_id: userId,
    p_entitlement_key: key,
  });
  return error ? null : parseEntitlement(data);
}

export async function reserveUsage(input: {
  userId: string;
  usageKey: UsageKey;
  requestedAmount: number;
  idempotencyKey: string;
  correlationId: string;
}) {
  const { data, error } = await createAdminClient().rpc("reserve_usage", {
    p_user_id: input.userId,
    p_usage_key: input.usageKey,
    p_requested_amount: input.requestedAmount,
    p_idempotency_key: input.idempotencyKey,
    p_correlation_id: input.correlationId,
  });
  if (error || !data?.[0]) throw new Error("quota_reservation_failed");
  const reservation = data[0];
  const mode = getFeatureFlags().quotaEnforcementMode;
  const outcome = reservation.allowed ? "allowed" : mode === "observe" ? "allowed" : "denied";
  recordTelemetry({
    name: "capystudy.quota.decided",
    correlationId: input.correlationId,
    resource: input.usageKey.startsWith("documents") ? "document_ai" : "typing_ai",
    mode,
    outcome: outcome === "allowed" ? "allowed" : "denied",
  });
  return { ...reservation, enforcementMode: mode, wouldBlock: !reservation.allowed };
}

export async function finalizeUsage(reservationId: string, actualAmount: number): Promise<void> {
  const { error } = await createAdminClient().rpc("finalize_usage", {
    p_reservation_id: reservationId,
    p_actual_amount: actualAmount,
  });
  if (error) throw new Error("quota_finalization_failed");
}

export async function refundUsage(reservationId: string, reason: string): Promise<void> {
  const { error } = await createAdminClient().rpc("refund_usage", {
    p_reservation_id: reservationId,
    p_reason: reason,
  });
  if (error) throw new Error("quota_refund_failed");
}

export async function getIntegerEntitlement(userId: string, key: string): Promise<number | null> {
  const value = await getEntitlement(userId, key);
  return value?.value_type === "integer" ? value.integer_value : null;
}
