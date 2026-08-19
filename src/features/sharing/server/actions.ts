"use server";

import { revalidatePath } from "next/cache";
import type { ZodError } from "zod";

import { cloneSharedSetSchema, shareActionSchema } from "@/features/sharing/schemas/share-schema";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getFeatureFlags } from "@/lib/telemetry/feature-flags";

type ShareActionResult = { ok: true } | { ok: false; error: string };

function firstIssueMessage(error: ZodError): string {
  return error.issues[0]?.message ?? "Dữ liệu không hợp lệ.";
}

async function authenticatedUserId(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string | null> {
  const { data } = await supabase.auth.getClaims();
  const subject = data?.claims?.sub;
  return typeof subject === "string" && subject.length > 0 ? subject : null;
}

export async function createShareLink(setId: string): Promise<ShareActionResult> {
  const parsed = shareActionSchema.safeParse({ setId });
  if (!parsed.success) return { ok: false, error: firstIssueMessage(parsed.error) };

  const supabase = await createClient();
  const userId = await authenticatedUserId(supabase);
  if (!userId) return { ok: false, error: "Phiên đăng nhập đã hết hạn." };

  const admin = createAdminClient();
  const { error } = await admin.rpc("create_set_share_token", {
    p_user_id: userId,
    p_set_id: parsed.data.setId,
  });

  if (error) return { ok: false, error: "Không thể tạo link chia sẻ lúc này." };

  revalidatePath(`/sets/${parsed.data.setId}`);
  return { ok: true };
}

export async function revokeShareLink(setId: string): Promise<ShareActionResult> {
  const parsed = shareActionSchema.safeParse({ setId });
  if (!parsed.success) return { ok: false, error: firstIssueMessage(parsed.error) };

  const supabase = await createClient();
  const userId = await authenticatedUserId(supabase);
  if (!userId) return { ok: false, error: "Phiên đăng nhập đã hết hạn." };

  const admin = createAdminClient();
  const { error } = await admin.rpc("revoke_set_share_token", {
    p_user_id: userId,
    p_set_id: parsed.data.setId,
  });

  if (error) return { ok: false, error: "Không thể tắt chia sẻ lúc này." };

  revalidatePath(`/sets/${parsed.data.setId}`);
  return { ok: true };
}

export async function setClassroomEnabled(
  setId: string,
  enabled: boolean,
): Promise<ShareActionResult> {
  const parsed = shareActionSchema.safeParse({ setId, enabled });
  if (!parsed.success) return { ok: false, error: firstIssueMessage(parsed.error) };

  const supabase = await createClient();
  const userId = await authenticatedUserId(supabase);
  if (!userId) return { ok: false, error: "Phiên đăng nhập đã hết hạn." };

  const admin = createAdminClient();
  const { error } = await admin.rpc("set_set_classroom_enabled", {
    p_user_id: userId,
    p_set_id: parsed.data.setId,
    p_enabled: parsed.data.enabled ?? false,
  });

  if (error) return { ok: false, error: "Không thể đổi chế độ lớp học lúc này." };

  revalidatePath(`/sets/${parsed.data.setId}`);
  return { ok: true };
}

export async function cloneSharedSet(
  token: string,
): Promise<{ setId: string; alreadyExists: boolean } | { error: string }> {
  const parsed = cloneSharedSetSchema.safeParse({ token });
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

  const supabase = await createClient();
  const userId = await authenticatedUserId(supabase);
  if (!userId) return { error: "Bạn cần đăng nhập để lưu bộ flashcard này." };

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("clone_shared_set_with_quota", {
    p_token: parsed.data.token,
    p_user_id: userId,
    p_enforcement_mode: getFeatureFlags().quotaEnforcementMode,
  });

  if (error || !data?.[0]?.new_set_id) {
    if (error?.message === "storage_quota_exceeded") {
      return { error: "Bạn đã đạt giới hạn bộ hoặc thẻ của gói hiện tại." };
    }
    return { error: "Không thể lưu bộ flashcard này lúc này. Vui lòng thử lại." };
  }

  revalidatePath("/sets");
  revalidatePath("/sets/library");

  return { setId: data[0].new_set_id, alreadyExists: data[0].already_exists ?? false };
}
