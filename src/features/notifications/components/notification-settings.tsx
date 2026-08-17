"use client";

import { useState, useTransition } from "react";

import {
  deletePushSubscription,
  saveNotificationPreferences,
  savePushSubscription,
} from "@/features/notifications/server/actions";
import type { NotificationPreferences } from "@/features/notifications/types/notification-types";
import { urlBase64ToUint8Array } from "@/features/notifications/utils/vapid";

export function NotificationSettings({
  prefs,
  vapidPublicKey,
}: Readonly<{
  prefs: NotificationPreferences | null;
  vapidPublicKey: string;
}>) {
  const [pushEnabled, setPushEnabled] = useState<boolean>(prefs?.push_enabled ?? false);
  const [streakEnabled, setStreakEnabled] = useState<boolean>(prefs?.streak_enabled ?? true);
  const [streakTime, setStreakTime] = useState<string>(
    prefs?.streak_time ? prefs.streak_time.substring(0, 5) : "19:00",
  );
  const [reviewEnabled, setReviewEnabled] = useState<boolean>(prefs?.review_enabled ?? true);
  const [reviewTime, setReviewTime] = useState<string>(
    prefs?.review_time ? prefs.review_time.substring(0, 5) : "19:00",
  );

  const [permission, setPermission] = useState<NotificationPermission>(() => {
    return typeof window !== "undefined" && "Notification" in window
      ? Notification.permission
      : "default";
  });
  const [isSupported] = useState<boolean>(() => {
    return (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window
    );
  });
  const [isIOSNonStandalone] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const isIOS =
      /iPhone|iPad|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isStandalone =
      (typeof window.matchMedia === "function" &&
        window.matchMedia("(display-mode: standalone)").matches) ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    return isIOS && !isStandalone;
  });
  const [error, setError] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  async function persistPreferences(updated: {
    pushEnabled: boolean;
    streakEnabled: boolean;
    streakTime: string;
    reviewEnabled: boolean;
    reviewTime: string;
  }): Promise<boolean> {
    const res = await saveNotificationPreferences(updated);
    if (!res.ok) {
      setError(res.error);
      return false;
    }
    setError("");
    return true;
  }

  function handleMasterToggleChange(checked: boolean): void {
    setError("");
    if (!checked) {
      startTransition(async () => {
        try {
          const registration = await navigator.serviceWorker.getRegistration();
          const subscription = await registration?.pushManager.getSubscription();
          if (subscription) {
            await subscription.unsubscribe();
          }
        } catch {
          // Ignore browser unsubscription failure
        }
        await deletePushSubscription();
        const ok = await persistPreferences({
          pushEnabled: false,
          streakEnabled,
          streakTime,
          reviewEnabled,
          reviewTime,
        });
        if (ok) {
          setPushEnabled(false);
        }
      });
      return;
    }

    // Turning ON
    if (!isSupported) {
      setError("Trình duyệt không hỗ trợ thông báo đẩy.");
      return;
    }

    startTransition(async () => {
      let currentPerm = Notification.permission;
      if (currentPerm === "default") {
        currentPerm = await Notification.requestPermission();
        setPermission(currentPerm);
      }

      if (currentPerm === "denied") {
        setError("Quyền thông báo bị từ chối. Vui lòng mở cài đặt trình duyệt để cho phép.");
        return;
      }

      if (currentPerm !== "granted") {
        return;
      }

      try {
        let registration: ServiceWorkerRegistration | undefined;
        try {
          registration = await navigator.serviceWorker.getRegistration();
          if (!registration && typeof navigator.serviceWorker.register === "function") {
            registration = await navigator.serviceWorker.register("/sw.js");
          }
        } catch {
          // SW registration might be unavailable or return 404 in dev environment
        }

        const keyToUse =
          vapidPublicKey ||
          "BBjAvYx8Ur4nE26SIcMLTlIcbO2QBQFp5Bs-QXPoKH8NYRJUZSl0bualUDrosubTuhFAVVDCaMBT_6G5yxcHcdQ";

        if (registration && keyToUse) {
          try {
            let subscription = await registration.pushManager.getSubscription();
            if (!subscription) {
              const applicationServerKey = urlBase64ToUint8Array(keyToUse) as BufferSource;
              subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey,
              });
            }

            if (subscription) {
              const subJson = subscription.toJSON();
              if (subJson.endpoint && subJson.keys?.p256dh && subJson.keys?.auth) {
                await savePushSubscription({
                  endpoint: subJson.endpoint,
                  p256dh: subJson.keys.p256dh,
                  auth: subJson.keys.auth,
                  userAgent: navigator.userAgent,
                });
              }
            }
          } catch {
            // Push subscription network error fallback
          }
        }

        const ok = await persistPreferences({
          pushEnabled: true,
          streakEnabled,
          streakTime,
          reviewEnabled,
          reviewTime,
        });
        if (ok) {
          setPushEnabled(true);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        setError(msg || "Không thể đăng ký nhận thông báo đẩy lúc này.");
      }
    });
  }

  function handleStreakToggle(checked: boolean): void {
    setError("");
    const prev = streakEnabled;
    setStreakEnabled(checked);
    startTransition(async () => {
      const ok = await persistPreferences({
        pushEnabled,
        streakEnabled: checked,
        streakTime,
        reviewEnabled,
        reviewTime,
      });
      if (!ok) setStreakEnabled(prev);
    });
  }

  function handleStreakTimeChange(time: string): void {
    setError("");
    const prev = streakTime;
    setStreakTime(time);
    startTransition(async () => {
      const ok = await persistPreferences({
        pushEnabled,
        streakEnabled,
        streakTime: time,
        reviewEnabled,
        reviewTime,
      });
      if (!ok) setStreakTime(prev);
    });
  }

  function handleReviewToggle(checked: boolean): void {
    setError("");
    const prev = reviewEnabled;
    setReviewEnabled(checked);
    startTransition(async () => {
      const ok = await persistPreferences({
        pushEnabled,
        streakEnabled,
        streakTime,
        reviewEnabled: checked,
        reviewTime,
      });
      if (!ok) setReviewEnabled(prev);
    });
  }

  function handleReviewTimeChange(time: string): void {
    setError("");
    const prev = reviewTime;
    setReviewTime(time);
    startTransition(async () => {
      const ok = await persistPreferences({
        pushEnabled,
        streakEnabled,
        streakTime,
        reviewEnabled,
        reviewTime: time,
      });
      if (!ok) setReviewTime(prev);
    });
  }

  return (
    <section
      className="rounded-3xl border border-border-soft bg-surface p-5 sm:p-6"
      aria-labelledby="notification-settings-heading"
    >
      <h2 id="notification-settings-heading" className="text-xl font-bold">
        Cài đặt Nhắc nhở
      </h2>
      <p className="mt-1 text-sm text-text-secondary">
        Nhận thông báo nhắc học bài hàng ngày để duy trì streak và ôn tập thẻ khó.
      </p>

      {isIOSNonStandalone ? (
        <div
          data-testid="ios-pwa-banner"
          className="mt-4 rounded-2xl border border-warning/40 bg-warning/10 p-4 text-sm"
        >
          <p className="font-semibold text-text-primary">
            Cài app lên màn hình chính để nhận thông báo (iOS 16.4+)
          </p>
          <p className="mt-1 text-text-secondary">
            Trên iPhone/iPad, Safari chỉ hỗ trợ nhận thông báo đẩy sau khi bạn thêm ứng dụng vào Màn
            hình chính (Nhấn biểu tượng Chia sẻ ➔ chọn &quot;Thêm vào MH chính&quot;).
          </p>
        </div>
      ) : null}

      <div className="mt-5 space-y-5">
        {/* Master Toggle */}
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-border-soft bg-surface-subtle p-4">
          <div>
            <label htmlFor="master-push-toggle" className="font-semibold text-text-primary">
              Cho phép nhắc nhở
            </label>
            <p className="text-xs text-text-secondary">
              {!isSupported
                ? "Trình duyệt không hỗ trợ thông báo đẩy."
                : permission === "denied"
                  ? "Quyền thông báo bị từ chối trong cài đặt trình duyệt."
                  : "Bật/tắt toàn bộ thông báo đẩy tới thiết bị này."}
            </p>
          </div>
          <input
            id="master-push-toggle"
            type="checkbox"
            role="switch"
            aria-checked={pushEnabled}
            checked={pushEnabled}
            disabled={!isSupported || isPending}
            onChange={(e) => handleMasterToggleChange(e.target.checked)}
            className="size-5 cursor-pointer accent-primary disabled:cursor-not-allowed"
          />
        </div>

        {/* Child Reminders */}
        <div
          className={`space-y-4 transition-opacity duration-200 ${
            pushEnabled ? "opacity-100" : "pointer-events-none opacity-50"
          }`}
        >
          {/* Streak Reminder */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border-soft p-4">
            <div className="flex items-center gap-3">
              <input
                id="streak-reminder-toggle"
                type="checkbox"
                checked={streakEnabled}
                disabled={!pushEnabled || isPending}
                onChange={(e) => handleStreakToggle(e.target.checked)}
                className="size-4 cursor-pointer accent-primary disabled:cursor-not-allowed"
              />
              <label htmlFor="streak-reminder-toggle" className="text-sm font-medium">
                Nhắc giữ streak
              </label>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="streak-time-input" className="text-xs text-text-secondary">
                Giờ gửi:
              </label>
              <input
                id="streak-time-input"
                type="time"
                aria-label="Giờ nhắc giữ streak"
                value={streakTime}
                disabled={!pushEnabled || !streakEnabled || isPending}
                onChange={(e) => handleStreakTimeChange(e.target.value)}
                className="rounded-xl border border-border-soft bg-surface px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
          </div>

          {/* Review Reminder */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border-soft p-4">
            <div className="flex items-center gap-3">
              <input
                id="review-reminder-toggle"
                type="checkbox"
                checked={reviewEnabled}
                disabled={!pushEnabled || isPending}
                onChange={(e) => handleReviewToggle(e.target.checked)}
                className="size-4 cursor-pointer accent-primary disabled:cursor-not-allowed"
              />
              <label htmlFor="review-reminder-toggle" className="text-sm font-medium">
                Nhắc ôn tập
              </label>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="review-time-input" className="text-xs text-text-secondary">
                Giờ gửi:
              </label>
              <input
                id="review-time-input"
                type="time"
                aria-label="Giờ nhắc ôn tập"
                value={reviewTime}
                disabled={!pushEnabled || !reviewEnabled || isPending}
                onChange={(e) => handleReviewTimeChange(e.target.value)}
                className="rounded-xl border border-border-soft bg-surface px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
          </div>
        </div>
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-sm text-danger font-medium">
          {error}
        </p>
      ) : null}
    </section>
  );
}
