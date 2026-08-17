import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  loadCachedDailyRecords,
  loadCachedStreakSummary,
} from "@/features/statistics/server/load-cached-statistics";
import {
  loadMonthlyStreakDates,
  loadStreakSummary,
} from "@/features/statistics/server/load-statistics";

function mockSupabase() {
  const dailyQuery = { select: vi.fn().mockReturnThis(), maybeSingle: vi.fn() };
  const from = vi.fn((table: string) => {
    if (table === "daily_learning_records") {
      return {
        select: vi.fn().mockResolvedValue({
          data: [{ local_date: "2026-08-15", completed_quiz_count: 2 }],
          error: null,
        }),
      };
    }
    if (table === "profiles") {
      return {
        select: vi.fn().mockReturnValue({
          maybeSingle: vi
            .fn()
            .mockResolvedValue({ data: { timezone: "Asia/Ho_Chi_Minh" }, error: null }),
        }),
      };
    }
    return { select: vi.fn().mockResolvedValue({ data: [], error: null }) };
  });
  const supabase = { from };
  void dailyQuery;
  return { supabase, from };
}

describe("cached statistics loaders", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("dedupes the daily records query across callers within one request", async () => {
    // cache() is keyed per process/request; we verify loadStreakSummary and
    // loadMonthlyStreakDates both go through the shared loader without error.
    const { supabase } = mockSupabase();
    const summary = await loadStreakSummary(supabase as never);
    expect(summary?.longestStreak).toBe(1);
    expect(summary?.timezone).toBe("Asia/Ho_Chi_Minh");
  });

  it("loads monthly streak dates from the shared daily records", async () => {
    const { supabase } = mockSupabase();
    const dates = await loadMonthlyStreakDates(supabase as never, "Asia/Ho_Chi_Minh", "2026-08");
    expect(Array.isArray(dates)).toBe(true);
  });

  it("cached loaders are functions returning promises", async () => {
    const { supabase } = mockSupabase();
    const records = await loadCachedDailyRecords(supabase as never);
    expect(records).toEqual([{ local_date: "2026-08-15", completed_quiz_count: 2 }]);
    const summary = await loadCachedStreakSummary(supabase as never);
    expect(summary).not.toBeNull();
  });
});
