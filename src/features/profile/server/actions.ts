"use server";

import { revalidatePath } from "next/cache";
import type { ZodError } from "zod";

import { updateProfileSchema } from "@/features/profile/schemas/profile-schema";
import { mapMutationError, type MutationResult } from "@/lib/mutation-error";
import { createClient } from "@/lib/supabase/server";

function firstIssueMessage(error: ZodError): string {
  return error.issues[0]?.message ?? "Dữ liệu không hợp lệ.";
}

export async function updateProfile(input: unknown): Promise<MutationResult> {
  const parsed = updateProfileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssueMessage(parsed.error) };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims) return { ok: false, error: "Phiên đăng nhập đã hết hạn." };

  const { data, error } = await supabase.rpc("update_profile", {
    p_display_name: parsed.data.displayName ?? "",
    p_timezone: parsed.data.timezone,
  });

  if (error) return { ok: false, error: mapMutationError(error) };
  if (!data) return { ok: false, error: "Không tìm thấy hồ sơ." };

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  return { ok: true };
}
