import type { Metadata } from "next";

import { ProfileSettingsForm } from "@/features/profile/components/profile-settings-form";
import { loadProfileSettings } from "@/features/profile/server/load-profile";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Cài đặt",
};

export default async function SettingsPage() {
  const profile = await loadProfileSettings(await createClient());

  return (
    <main className="mx-auto w-full max-w-4xl p-4 sm:p-8">
      <h1 className="text-3xl font-bold">Cài đặt</h1>
      <p className="mt-2 text-text-secondary">Quản lý hồ sơ và múi giờ của bạn.</p>
      {profile ? (
        <ProfileSettingsForm
          email={profile.email}
          displayName={profile.displayName}
          timezone={profile.timezone}
        />
      ) : (
        <p role="alert" className="mt-4 text-danger">
          Không thể tải hồ sơ.
        </p>
      )}
    </main>
  );
}
