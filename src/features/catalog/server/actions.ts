"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";

import { catalogSetIdSchema } from "@/features/catalog/schemas/catalog-schema";
import { getEffectivePlan } from "@/features/entitlements/server/entitlement-service";
import { consumeRateLimit, rateLimitMessage, subjectRateLimitKey } from "@/lib/security/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getFeatureFlags } from "@/lib/telemetry/feature-flags";

export type InstallCatalogResult =
  { ok: true; setId: string; alreadyExists: boolean } | { ok: false; error: string };

export async function installCatalogSet(input: unknown): Promise<InstallCatalogResult> {
  if (!getFeatureFlags().catalogEnabled) {
    return { ok: false, error: "Thư viện Flashcard hiện chưa được bật." };
  }
  const parsed = catalogSetIdSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims.sub;
  if (!userId) return { ok: false, error: "Phiên đăng nhập đã hết hạn." };

  const plan = await getEffectivePlan(userId);
  const policy = plan === "free" ? "catalogInstallFree" : "catalogInstallPro";
  const rateLimit = await consumeRateLimit(policy, subjectRateLimitKey(policy, userId));
  if (!rateLimit.ok) return { ok: false, error: rateLimitMessage(rateLimit) };

  const { data, error } = await createAdminClient().rpc("install_catalog_set_for_user", {
    p_user_id: userId,
    p_catalog_set_id: parsed.data,
    p_idempotency_key: randomUUID(),
  });
  const installed = data?.[0];
  if (error || !installed) {
    if (
      error?.message === "catalog_storage_quota_exceeded" ||
      error?.message === "storage_quota_exceeded"
    ) {
      return { ok: false, error: "Bạn đã đạt giới hạn bộ hoặc thẻ của gói hiện tại." };
    }
    if (error?.message === "catalog_hard_storage_ceiling") {
      return { ok: false, error: "Tài khoản đã đạt giới hạn an toàn lưu trữ." };
    }
    if (error?.code === "P0002") return { ok: false, error: "Bộ thư viện không còn khả dụng." };
    return { ok: false, error: "Không thể thêm bộ lúc này. Vui lòng thử lại." };
  }

  revalidatePath("/sets/catalog");
  revalidatePath(`/sets/catalog/${parsed.data}`);
  revalidatePath("/sets/library");
  return { ok: true, setId: installed.set_id, alreadyExists: installed.already_exists };
}
