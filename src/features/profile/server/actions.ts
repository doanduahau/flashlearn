"use server";

import { revalidatePath } from "next/cache";
import type { ZodError } from "zod";

import { updateProfileSchema } from "@/features/profile/schemas/profile-schema";
import { mapMutationError } from "@/lib/mutation-error";
import { createClient } from "@/lib/supabase/server";

const TIMEZONE_CHANGE_COOLDOWN_MS = 72 * 60 * 60 * 1000;

export type UpdateProfileResult =
  | {
      ok: true;
      timezoneChangeAvailableAt: string | null;
      timezoneChangeCooldownHours: number | null;
    }
  | {
      ok: false;
      error: string;
      code?: "timezone_change_cooldown";
      timezoneChangeAvailableAt?: string;
      timezoneChangeCooldownHours?: number;
    };

function firstIssueMessage(error: ZodError): string {
  return error.issues[0]?.message ?? "Dữ liệu không hợp lệ.";
}

function cooldownHours(availableAt: string): number {
  return Math.max(
    0,
    Math.ceil(((new Date(availableAt).getTime() - Date.now()) / TIMEZONE_CHANGE_COOLDOWN_MS) * 72),
  );
}

function timezoneCooldownResult(error: {
  code?: string;
  details?: string;
  message?: string;
}): UpdateProfileResult | null {
  if (error.code !== "P0001" || error.message !== "timezone_change_cooldown") return null;

  try {
    const details: unknown = error.details ? JSON.parse(error.details) : null;
    if (
      typeof details === "object" &&
      details !== null &&
      "available_at" in details &&
      typeof details.available_at === "string"
    ) {
      return {
        ok: false,
        code: "timezone_change_cooldown",
        error: "Bạn chỉ có thể thay đổi múi giờ mỗi 72 giờ.",
        timezoneChangeAvailableAt: details.available_at,
        timezoneChangeCooldownHours: cooldownHours(details.available_at),
      };
    }
  } catch {
    // A malformed database detail must not expose an internal error to the UI.
  }

  return {
    ok: false,
    code: "timezone_change_cooldown",
    error: "Bạn chỉ có thể thay đổi múi giờ mỗi 72 giờ.",
  };
}

export async function updateProfile(input: unknown): Promise<UpdateProfileResult> {
  const parsed = updateProfileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssueMessage(parsed.error) };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims) return { ok: false, error: "Phiên đăng nhập đã hết hạn." };

  const { data, error } = await supabase.rpc("update_profile", {
    p_display_name: parsed.data.displayName ?? "",
    p_timezone: parsed.data.timezone,
  });

  if (error) return timezoneCooldownResult(error) ?? { ok: false, error: mapMutationError(error) };
  if (!data) return { ok: false, error: "Không tìm thấy hồ sơ." };

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  const timezoneChangeAvailableAt = data.timezone_changed_at
    ? new Date(
        new Date(data.timezone_changed_at).getTime() + TIMEZONE_CHANGE_COOLDOWN_MS,
      ).toISOString()
    : null;
  return {
    ok: true,
    timezoneChangeAvailableAt,
    timezoneChangeCooldownHours: timezoneChangeAvailableAt
      ? cooldownHours(timezoneChangeAvailableAt)
      : null,
  };
}
