import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export async function claimStarterOnboardingBanner(userId: string): Promise<boolean> {
  try {
    const { data, error } = await createAdminClient().rpc("claim_starter_onboarding_banner", {
      p_user_id: userId,
    });
    return !error && data === true;
  } catch {
    return false;
  }
}
