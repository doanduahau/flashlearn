import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { DailyActivityDetail } from "@/features/statistics/utils/month-activity";
import {
  computeSevenDayInsight,
  getSevenDayBoundaries,
  type SevenDayInsight,
} from "@/features/statistics/utils/seven-day-insight";

const EMPTY: DailyActivityDetail[] = [];

export async function loadSevenDayInsight(
  supabase: SupabaseClient<Database>,
  today: string,
): Promise<SevenDayInsight | null> {
  const { currentStart, previousStart } = getSevenDayBoundaries(today);

  const { data, error } = await supabase
    .from("daily_learning_records")
    .select("local_date, completed_quiz_count, questions_answered, correct_answers")
    .gte("local_date", previousStart)
    .lte("local_date", today);

  if (error || !data) return null;

  const map = new Map<string, DailyActivityDetail>();
  for (const record of data) {
    map.set(record.local_date, {
      date: record.local_date,
      quizCount: record.completed_quiz_count,
      questions: record.questions_answered,
      correct: record.correct_answers,
    });
  }

  const currentPeriod: DailyActivityDetail[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(`${currentStart}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    const date = d.toISOString().slice(0, 10);
    const detail = map.get(date);
    if (detail) currentPeriod.push(detail);
  }

  const previousPeriod: DailyActivityDetail[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(`${previousStart}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    const date = d.toISOString().slice(0, 10);
    const detail = map.get(date);
    if (detail) previousPeriod.push(detail);
  }

  return computeSevenDayInsight(today, currentPeriod, previousPeriod);
}
