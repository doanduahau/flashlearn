// CapyStudy send-reminders — scheduled web-push sender.
//
// Triggered every 15 minutes by a pg_cron job (see supabase/cron/
// send-reminders.sql). For every user who has push enabled it checks
// whether the current local time (in the user's profile timezone) falls in
// the 15-minute window of their chosen streak/review reminder time, then
// sends a push notification if the trigger applies:
//   - streak: the user has no daily_learning_records entry for today.
//   - review: get_due_review_card_count(user) > 0.
// A push_notifications_log row (unique per user+kind+local_date) dedupes so
// each reminder fires at most once per local day.
//
// Env (Supabase secrets, never in the repo):
//   CRON_SECRET          — bearer token required to invoke this function.
//   VAPID_PUBLIC_KEY     — public VAPID key (also exposed client-side).
//   VAPID_PRIVATE_KEY    — private VAPID key (secret).
//   VAPID_SUBJECT        — mailto: contact for the VAPID identity.

import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.47.10";

type PreferenceRow = {
  user_id: string;
  streak_enabled: boolean;
  streak_time: string;
  review_enabled: boolean;
  review_time: string;
};

type SubscriptionRow = {
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

type UserState = {
  streakEnabled: boolean;
  streakTime: string;
  reviewEnabled: boolean;
  reviewTime: string;
  timezone: string;
  subscriptions: { endpoint: string; p256dh: string; auth: string }[];
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const vapidSubject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@capystudy.app";

webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

const FALLBACK_TIMEZONE = "Asia/Ho_Chi_Minh";
const WINDOW_MINUTES = 15;

function isInWindow(localTime: string, targetTime: string): boolean {
  const [targetHour, targetMinute] = targetTime.split(":").map(Number);
  const [hour, minute] = localTime.split(":").map(Number);
  const start = targetHour * 60 + targetMinute;
  const current = hour * 60 + minute;
  return current >= start && current < start + WINDOW_MINUTES;
}

function reminderUrl(kind: "streak" | "review"): string {
  return kind === "streak" ? "/study/mode" : "/quiz/mode";
}

async function hasStudiedToday(userId: string, localDate: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("daily_learning_records")
    .select("local_date")
    .eq("user_id", userId)
    .eq("local_date", localDate)
    .maybeSingle();
  if (error) throw error;
  return data !== null;
}

async function dueReviewCount(userId: string): Promise<number> {
  const { data, error } = await supabase.rpc("get_due_review_card_count", {
    p_user_id: userId,
  });
  if (error) throw error;
  return Number(data ?? 0);
}

async function alreadySent(
  userId: string,
  kind: "streak" | "review",
  localDate: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("push_notifications_log")
    .select("id")
    .eq("user_id", userId)
    .eq("kind", kind)
    .eq("local_date", localDate)
    .maybeSingle();
  if (error) throw error;
  return data !== null;
}

async function markSent(
  userId: string,
  kind: "streak" | "review",
  localDate: string,
): Promise<void> {
  // on conflict do nothing keeps the dedupe safe even if two runs overlap.
  await supabase.from("push_notifications_log").insert({
    user_id: userId,
    kind,
    local_date: localDate,
  });
}

async function sendToSubscriptions(
  userId: string,
  kind: "streak" | "review",
  title: string,
  body: string,
  subscriptions: { endpoint: string; p256dh: string; auth: string }[],
): Promise<{ sent: number; removed: number }> {
  let sent = 0;
  let removed = 0;
  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        JSON.stringify({ title, body, data: { url: reminderUrl(kind) } }),
      );
      sent += 1;
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        // Subscription is gone — prune it so the loop stops wasting calls.
        await supabase
          .from("push_subscriptions")
          .delete()
          .eq("user_id", userId)
          .eq("endpoint", subscription.endpoint);
        removed += 1;
      } else {
        console.error("push send failed", {
          userId,
          kind,
          status,
          endpoint: subscription.endpoint,
        });
      }
    }
  }
  return { sent, removed };
}

Deno.serve(async (request) => {
  if (request.headers.get("authorization") !== `Bearer ${Deno.env.get("CRON_SECRET") ?? ""}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    // 1) Users with push enabled + their reminder preferences.
    const { data: prefs, error: prefsError } = await supabase
      .from("notification_preferences")
      .select("user_id, streak_enabled, streak_time, review_enabled, review_time")
      .eq("push_enabled", true);
    if (prefsError) throw prefsError;
    const preferenceRows = (prefs ?? []) as unknown as PreferenceRow[];
    if (preferenceRows.length === 0) {
      return new Response(JSON.stringify({ sent: 0, removed: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 2) Timezones for those users (no direct FK between preferences and
    //    profiles — both point at auth.users — so fetch separately).
    const { data: profileRows, error: profileError } = await supabase
      .from("profiles")
      .select("id, timezone")
      .in(
        "id",
        preferenceRows.map((row) => row.user_id),
      );
    if (profileError) throw profileError;
    const timezoneById = new Map<string, string>(
      (profileRows ?? []).map((row) => [row.id, row.timezone ?? FALLBACK_TIMEZONE]),
    );

    // 3) Subscriptions for those users.
    const { data: subs, error: subsError } = await supabase
      .from("push_subscriptions")
      .select("user_id, endpoint, p256dh, auth")
      .in(
        "user_id",
        preferenceRows.map((row) => row.user_id),
      );
    if (subsError) throw subsError;
    const subscriptionRows = (subs ?? []) as unknown as SubscriptionRow[];

    // Group subscriptions per user.
    const users = new Map<string, UserState>();
    for (const pref of preferenceRows) {
      users.set(pref.user_id, {
        streakEnabled: pref.streak_enabled,
        streakTime: pref.streak_time,
        reviewEnabled: pref.review_enabled,
        reviewTime: pref.review_time,
        timezone: timezoneById.get(pref.user_id) ?? FALLBACK_TIMEZONE,
        subscriptions: [],
      });
    }
    for (const subscription of subscriptionRows) {
      const state = users.get(subscription.user_id);
      if (!state) continue;
      state.subscriptions.push({
        endpoint: subscription.endpoint,
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      });
    }

    let sent = 0;
    let removed = 0;

    for (const [userId, state] of users) {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: state.timezone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      const parts = formatter.formatToParts(now);
      const hour = parts.find((part) => part.type === "hour")?.value ?? "00";
      const minute = parts.find((part) => part.type === "minute")?.value ?? "00";
      const localTime = `${hour}:${minute}`;
      const localDate = new Intl.DateTimeFormat("en-CA", {
        timeZone: state.timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(now);

      if (state.streakEnabled && isInWindow(localTime, state.streakTime)) {
        if (
          !(await alreadySent(userId, "streak", localDate)) &&
          !(await hasStudiedToday(userId, localDate))
        ) {
          const result = await sendToSubscriptions(
            userId,
            "streak",
            "CapyStudy",
            "Hôm nay chưa học — giữ streak nào! 📚",
            state.subscriptions,
          );
          sent += result.sent;
          removed += result.removed;
          // Only dedupe when at least one device actually received it, so a
          // transient delivery failure can retry in the next window.
          if (result.sent > 0) await markSent(userId, "streak", localDate);
        }
      }

      if (state.reviewEnabled && isInWindow(localTime, state.reviewTime)) {
        if (!(await alreadySent(userId, "review", localDate))) {
          const count = await dueReviewCount(userId);
          if (count > 0) {
            const result = await sendToSubscriptions(
              userId,
              "review",
              "CapyStudy",
              `Còn ${count} thẻ cần ôn — vào ôn ngay nhé! 🎯`,
              state.subscriptions,
            );
            sent += result.sent;
            removed += result.removed;
            if (result.sent > 0) await markSent(userId, "review", localDate);
          }
        }
      }
    }

    return new Response(JSON.stringify({ sent, removed }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("send-reminders failed", error);
    return new Response(JSON.stringify({ error: "internal error" }), { status: 500 });
  }
});
