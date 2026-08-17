"use server";

import { revalidatePath } from "next/cache";
import type { ZodError } from "zod";

import {
  deletePushSubscriptionSchema,
  saveNotificationPreferencesSchema,
  savePushSubscriptionSchema,
  type DeletePushSubscriptionInput,
  type SaveNotificationPreferencesInput,
  type SavePushSubscriptionInput,
} from "@/features/notifications/schemas/notification-schema";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type NotificationActionResult = { ok: true } | { ok: false; error: string };

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

export async function saveNotificationPreferences(
  input: SaveNotificationPreferencesInput,
): Promise<NotificationActionResult> {
  const parsed = saveNotificationPreferencesSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssueMessage(parsed.error) };
  }

  const supabase = await createClient();
  const userId = await authenticatedUserId(supabase);
  if (!userId) {
    return { ok: false, error: "Phiên đăng nhập đã hết hạn." };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("notification_preferences").upsert(
    {
      user_id: userId,
      push_enabled: parsed.data.pushEnabled,
      streak_enabled: parsed.data.streakEnabled,
      streak_time: parsed.data.streakTime,
      review_enabled: parsed.data.reviewEnabled,
      review_time: parsed.data.reviewTime,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    console.error("[saveNotificationPreferences error]", error);
    return { ok: false, error: "Không thể lưu cài đặt nhắc nhở lúc này." };
  }

  revalidatePath("/profile");
  return { ok: true };
}

export async function savePushSubscription(
  input: SavePushSubscriptionInput,
): Promise<NotificationActionResult> {
  const parsed = savePushSubscriptionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssueMessage(parsed.error) };
  }

  const supabase = await createClient();
  const userId = await authenticatedUserId(supabase);
  if (!userId) {
    return { ok: false, error: "Phiên đăng nhập đã hết hạn." };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.p256dh,
      auth: parsed.data.auth,
      user_agent: parsed.data.userAgent,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,endpoint" },
  );

  if (error) {
    console.error("[savePushSubscription error]", error);
    return { ok: false, error: "Không thể đăng ký nhận thông báo lúc này." };
  }

  return { ok: true };
}

export async function deletePushSubscription(
  input?: DeletePushSubscriptionInput,
): Promise<NotificationActionResult> {
  const parsed = deletePushSubscriptionSchema.safeParse(input ?? {});
  if (!parsed.success) {
    return { ok: false, error: firstIssueMessage(parsed.error) };
  }

  const supabase = await createClient();
  const userId = await authenticatedUserId(supabase);
  if (!userId) {
    return { ok: false, error: "Phiên đăng nhập đã hết hạn." };
  }

  const admin = createAdminClient();
  let query = admin.from("push_subscriptions").delete().eq("user_id", userId);
  if (parsed.data.endpoint) {
    query = query.eq("endpoint", parsed.data.endpoint);
  }

  const { error } = await query;
  if (error) {
    return { ok: false, error: "Không thể hủy đăng ký thông báo lúc này." };
  }

  return { ok: true };
}
