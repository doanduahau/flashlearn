"use server";

import { revalidatePath } from "next/cache";

import { importPayloadSchema } from "@/features/imports/schemas/import-schema";
import { getEffectivePlan } from "@/features/entitlements/server/entitlement-service";
import {
  IMPORT_REQUEST_LIMITS,
  STORAGE_PLAN_LIMITS,
  storagePlanTier,
} from "@/features/entitlements/storage-limits";
import { createClient } from "@/lib/supabase/server";
import { consumeRateLimit, rateLimitMessage, subjectRateLimitKey } from "@/lib/security/rate-limit";
import { getFeatureFlags } from "@/lib/telemetry/feature-flags";

function importErrorMessage(error: { message?: string; code?: string } | null): string {
  if (error?.message === "storage_quota_exceeded")
    return "Bạn đã đạt giới hạn bộ hoặc thẻ của gói hiện tại.";
  if (error?.message === "storage_card_side_limit")
    return "Một mặt thẻ vượt giới hạn ký tự của gói hiện tại.";
  if (error?.message === "import_per_request_limit")
    return "Lần import này vượt giới hạn của gói hiện tại. Hãy giảm số thẻ hoặc kích thước nguồn.";
  if (error?.code === "23505") return "Yêu cầu này đang được xử lý. Vui lòng chờ.";
  return "Không thể import bộ flashcard. Không có dữ liệu nào được lưu.";
}

export async function importFlashcards(
  input: unknown,
): Promise<{ setId: string } | { error: string }> {
  const parsed = importPayloadSchema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Dữ liệu import không hợp lệ." };

  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return { error: "Không thể kết nối đến máy chủ. Vui lòng thử lại." };
  }

  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (typeof userId !== "string") return { error: "Phiên đăng nhập đã hết hạn." };

  const plan = await getEffectivePlan(userId);
  const tier = storagePlanTier(plan);
  const limits = IMPORT_REQUEST_LIMITS[parsed.data.source][tier];
  const enforcementMode = getFeatureFlags().quotaEnforcementMode;
  if (
    enforcementMode === "block" &&
    (parsed.data.cards.length > limits.cards ||
      (limits.sourceBytes !== undefined && parsed.data.sourceBytes > limits.sourceBytes) ||
      (limits.sourceChars !== undefined && parsed.data.sourceChars > limits.sourceChars))
  ) {
    return {
      error:
        "Lần import này vượt giới hạn của gói hiện tại. Hãy giảm số thẻ hoặc kích thước nguồn.",
    };
  }
  if (
    enforcementMode === "block" &&
    parsed.data.cards.some(
      (card) =>
        card.front.length > STORAGE_PLAN_LIMITS[tier].cardSideChars ||
        card.back.length > STORAGE_PLAN_LIMITS[tier].cardSideChars,
    )
  ) {
    return { error: "Một mặt thẻ vượt giới hạn ký tự của gói hiện tại." };
  }

  const ratePolicy = tier === "free" ? "import" : "importPro";
  const rateLimit = await consumeRateLimit(ratePolicy, subjectRateLimitKey(ratePolicy, userId));
  if (!rateLimit.ok) return { error: rateLimitMessage(rateLimit) };

  try {
    const { data, error } = await supabase.rpc("commit_flashcard_import", {
      p_name: parsed.data.name,
      p_cards: parsed.data.cards,
      p_idempotency_key: parsed.data.idempotencyKey,
      p_source_type: parsed.data.source,
      p_source_bytes: parsed.data.sourceBytes,
      p_source_chars: parsed.data.sourceChars,
      p_ai_used: parsed.data.aiUsed,
    });
    if (error || !data?.[0]?.set_id) return { error: importErrorMessage(error) };
    revalidatePath("/sets");
    revalidatePath("/sets/library");
    return { setId: data[0].set_id };
  } catch {
    return { error: "Không thể tạo bộ flashcard. Vui lòng thử lại." };
  }
}
