import type { Metadata } from "next";
import { Suspense } from "react";

import { SectionTabs } from "@/components/shared/section-tabs";
import { SignOutButton } from "@/features/auth/components/sign-out-button";
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
            <StatisticsPanel month={raw.month} />
          ) : (
            <ProfileDetails tab={tab} />
          )}
        </Suspense>
      </SectionTabs>
    </main>
  );
}

async function ProfileDetails({ tab }: Readonly<{ tab: Exclude<ProfileTab, "statistics"> }>) {
  const profile = await loadProfileSettings(await createClient());

  if (!profile) {
    return (
      <p role="alert" className="mt-6 text-danger">
        Không thể tải hồ sơ.
      </p>
    );
  }

  if (tab === "settings") {
    return (
      <div className="space-y-6">
        <ProfileSettingsForm
          email={profile.email}
          displayName={profile.displayName}
          timezone={profile.timezone}
          timezoneChangeAvailableAt={profile.timezoneChangeAvailableAt}
          timezoneChangeCooldownHours={profile.timezoneChangeCooldownHours}
        />
        <section
          className="rounded-3xl border border-border-soft bg-surface p-5"
          aria-labelledby="sign-out-heading"
        >
          <h2 id="sign-out-heading" className="text-xl font-bold">
            Đăng xuất
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            Đăng xuất khỏi tài khoản trên thiết bị này.
          </p>
          <div className="mt-4">
            <SignOutButton />
          </div>
        </section>
      </div>
    );
  }

  return (
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
  );
}

function ProfileTabLoading() {
  return (
    <section aria-label="Đang tải nội dung cá nhân" className="mt-6 space-y-4" role="status">
      <div className="h-7 w-36 animate-pulse rounded-lg bg-surface-subtle" />
      <div className="h-32 animate-pulse rounded-3xl bg-surface-subtle" />
    </section>
  );
}
