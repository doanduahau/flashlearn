import { cache } from "react";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/types";
import { loadStreakSummary } from "@/features/statistics/server/load-statistics";

type DailyRecord = { local_date: string; completed_quiz_count: number };

/**
 * Loads every daily learning record once per request. React `cache()` only
 * memoizes within a single server render, so this removes duplicate queries
 * across the app layout, the dashboard and the mascot level without ever
 * serving stale data between requests.
 */
export const loadCachedDailyRecords = cache(
  async (supabase: SupabaseClient<Database>): Promise<DailyRecord[] | null> => {
    const { data, error } = await supabase
      .from("daily_learning_records")
      .select("local_date, completed_quiz_count");
    if (error || !data) return null;
    return data.map((record) => ({
      local_date: record.local_date,
      completed_quiz_count: record.completed_quiz_count,
    }));
  },
);

/**
 * Loads the profile timezone once per request (shared by the streak summary
 * and the monthly streak dates, which both need it).
 */
export const loadCachedProfileTimezone = cache(
  async (supabase: SupabaseClient<Database>): Promise<string | null> => {
    const { data } = await supabase.from("profiles").select("timezone").maybeSingle();
    return data?.timezone ?? null;
  },
);

/**
 * Cached streak summary shared by the app layout, the dashboard and the mascot
 * level so the same summary (and its daily-record queries) run once per render.
 */
export const loadCachedStreakSummary = cache(loadStreakSummary);
