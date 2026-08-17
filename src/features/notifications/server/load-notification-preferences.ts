import type { NotificationPreferences } from "@/features/notifications/types/notification-types";
import { createClient } from "@/lib/supabase/server";

export async function loadNotificationPreferences(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<NotificationPreferences | null> {
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (typeof userId !== "string" || userId.length === 0) {
    return null;
  }

  const { data, error } = await supabase
    .from("notification_preferences")
    .select(
      "user_id, push_enabled, streak_enabled, streak_time, review_enabled, review_time, updated_at",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    user_id: data.user_id,
    push_enabled: data.push_enabled,
    streak_enabled: data.streak_enabled,
    streak_time: typeof data.streak_time === "string" ? data.streak_time.substring(0, 5) : "19:00",
    review_enabled: data.review_enabled,
    review_time: typeof data.review_time === "string" ? data.review_time.substring(0, 5) : "19:00",
    updated_at: data.updated_at,
  };
}
