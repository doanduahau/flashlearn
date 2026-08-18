import type { Metadata } from "next";
import { Suspense } from "react";

import { BrandLoading } from "@/components/shared/brand-loading";
import { SectionTabs } from "@/components/shared/section-tabs";
import { SignOutButton } from "@/features/auth/components/sign-out-button";
import { MilestoneMascots } from "@/features/mascot/components/milestone-mascots";
import { loadMascotLevel } from "@/features/mascot/server/load-mascot-level";
import { NotificationSettings } from "@/features/notifications/components/notification-settings";
import { loadNotificationPreferences } from "@/features/notifications/server/load-notification-preferences";
import { ProfileSettingsForm } from "@/features/profile/components/profile-settings-form";
import { loadProfileSettings } from "@/features/profile/server/load-profile";
import { StatisticsPanel } from "@/features/statistics/components/statistics-panel";
import { type RouteSearchParams, updateSearchParamHref } from "@/lib/pagination";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Cá nhân" };

type ProfileTab = "profile" | "statistics" | "settings";

function profileTab(value: string | string[] | undefined): ProfileTab {
  return value === "statistics" || value === "settings" ? value : "profile";
}

export default async function ProfilePage({
  searchParams,
}: Readonly<{ searchParams: Promise<RouteSearchParams> }>) {
  const raw = await searchParams;
  const tab = profileTab(raw.tab);

  return (
    <main className="mx-auto w-full max-w-5xl p-4 sm:p-8">
      <h1 className="text-3xl font-bold">Cá nhân</h1>
      <p className="mt-2 text-text-secondary">Hồ sơ, quá trình học và cài đặt của bạn.</p>
      <SectionTabs
        label="Nội dung cá nhân"
        current={tab}
        items={[
          {
            value: "profile",
            label: "Hồ sơ",
            href: updateSearchParamHref("/profile", raw, "tab", "profile"),
          },
          {
            value: "statistics",
            label: "Thống kê",
            href: updateSearchParamHref("/profile", raw, "tab", "statistics"),
          },
          {
            value: "settings",
            label: "Cài đặt",
            href: updateSearchParamHref("/profile", raw, "tab", "settings"),
          },
        ]}
        pendingContent={<ProfileTabLoading />}
      >
        <Suspense fallback={<ProfileTabLoading />}>
          {tab === "statistics" ? (
            <StatisticsPanel month={raw.month} view={raw.view} />
          ) : (
            <ProfileDetails tab={tab} />
          )}
        </Suspense>
      </SectionTabs>
    </main>
  );
}

async function ProfileDetails({ tab }: Readonly<{ tab: Exclude<ProfileTab, "statistics"> }>) {
  const supabase = await createClient();
  const [profile, mascotLevel] = await Promise.all([
    loadProfileSettings(supabase),
    loadMascotLevel(supabase),
  ]);

  if (!profile) {
    return (
      <p role="alert" className="mt-6 text-danger">
        Không thể tải hồ sơ.
      </p>
    );
  }

  if (tab === "settings") {
    const notificationPrefs = await loadNotificationPreferences(supabase);
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

    return (
      <div className="space-y-6">
        <ProfileSettingsForm
          email={profile.email}
          displayName={profile.displayName}
          timezone={profile.timezone}
          timezoneChangeAvailableAt={profile.timezoneChangeAvailableAt}
          timezoneChangeCooldownHours={profile.timezoneChangeCooldownHours}
        />
        <NotificationSettings prefs={notificationPrefs} vapidPublicKey={vapidPublicKey} />
        <section
          className="rounded-3xl border border-border-soft bg-surface p-5"
          aria-label="Đăng xuất"
        >
          <div className="flex items-center gap-3">
            <SignOutButton />
            <span className="text-sm font-medium">Đăng xuất</span>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section
        className="mt-6 rounded-3xl border border-border-soft bg-surface p-5"
        aria-labelledby="profile-summary-heading"
      >
        <h2 id="profile-summary-heading" className="text-xl font-bold">
          Hồ sơ của bạn
        </h2>
        <dl className="mt-4 space-y-4">
          <div>
            <dt className="text-sm text-text-secondary">Tên hiển thị</dt>
            <dd className="mt-1 font-semibold">{profile.displayName || profile.email}</dd>
          </div>
          <div>
            <dt className="text-sm text-text-secondary">Email</dt>
            <dd className="mt-1 font-semibold">{profile.email}</dd>
          </div>
          <div>
            <dt className="text-sm text-text-secondary">Múi giờ</dt>
            <dd className="mt-1 font-semibold">{profile.timezone}</dd>
          </div>
        </dl>
      </section>
      <MilestoneMascots mascotLevel={mascotLevel} />
    </div>
  );
}

function ProfileTabLoading() {
  return <BrandLoading title="Đang tải nội dung cá nhân" />;
}
