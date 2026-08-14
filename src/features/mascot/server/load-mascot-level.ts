import type { SupabaseClient } from "@supabase/supabase-js";

import { loadStreakSummary } from "@/features/statistics/server/load-statistics";
import type { Database } from "@/lib/supabase/types";
import type { MascotLevel } from "../types/mascot-types";
import { levelFromStreak } from "../utils/mascot-level";

/**
 * Resolves the authenticated user's mascot level from their current streak,
 * reusing the statistics streak loader rather than duplicating its logic.
 */
export async function loadMascotLevel(supabase: SupabaseClient<Database>): Promise<MascotLevel> {
  const streak = await loadStreakSummary(supabase);
  return levelFromStreak(streak?.currentStreak ?? 0);
}
