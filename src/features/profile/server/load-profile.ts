import type { SupabaseClient } from "@supabase/supabase-js";

import type { ProfileSettingsData } from "@/features/profile/types/profile-types";
import type { Database } from "@/lib/supabase/types";

type Supabase = SupabaseClient<Database>;
const TIMEZONE_CHANGE_COOLDOWN_MS = 72 * 60 * 60 * 1000;

export async function loadProfileSettings(supabase: Supabase): Promise<ProfileSettingsData | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, timezone, timezone_changed_at")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) return null;

  const timezoneChangeAvailableAt = profile.timezone_changed_at
    ? new Date(
        new Date(profile.timezone_changed_at).getTime() + TIMEZONE_CHANGE_COOLDOWN_MS,
      ).toISOString()
    : null;
  const timezoneChangeCooldownHours = timezoneChangeAvailableAt
    ? Math.max(
        0,
        Math.ceil((new Date(timezoneChangeAvailableAt).getTime() - Date.now()) / (60 * 60 * 1000)),
      )
    : null;

  return {
    email: user.email ?? "",
    displayName: profile.display_name,
    timezone: profile.timezone,
    timezoneChangeAvailableAt,
    timezoneChangeCooldownHours,
  };
}
