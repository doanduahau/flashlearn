import type { SupabaseClient } from "@supabase/supabase-js";

import type { ProfileSettingsData } from "@/features/profile/types/profile-types";
import type { Database } from "@/lib/supabase/types";

type Supabase = SupabaseClient<Database>;

export async function loadProfileSettings(supabase: Supabase): Promise<ProfileSettingsData | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, timezone")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) return null;

  return {
    email: user.email ?? "",
    displayName: profile.display_name,
    timezone: profile.timezone,
  };
}
