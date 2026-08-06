import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/types";
import { addMonths, dateInTimezone } from "@/features/statistics/utils/month-activity";

export type DailyActivity = { date: string; active: boolean };
export type ModeBreakdown = {
  mode: string;
  quiz_count: number;
  questions: number;
  correct: number;
};
export type RecentQuiz = {
  id: string;
  mode: string;
  completed_at: string;
  questions: number;
  correct: number;
};
export type LearningStatistics = {
  timezone: string;
  current_streak: number;
  longest_streak: number;
  completed_today: boolean;
  total_completed_quizzes: number;
  questions_answered: number;
  correct_answers: number;
  active_days: number;
  last_active_date: string | null;
  daily_activity: DailyActivity[];
  mode_breakdown: ModeBreakdown[];
  recent_quizzes: RecentQuiz[];
};
export const emptyStatistics: LearningStatistics = {
  timezone: "Asia/Ho_Chi_Minh",
  current_streak: 0,
  longest_streak: 0,
  completed_today: false,
  total_completed_quizzes: 0,
  questions_answered: 0,
  correct_answers: 0,
  active_days: 0,
  last_active_date: null,
  daily_activity: [],
  mode_breakdown: [],
  recent_quizzes: [],
};
type JsonObject = { [key: string]: Json | undefined };
function object(value: Json | undefined): JsonObject | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : null;
}
function objects(value: Json | undefined): JsonObject[] {
  return Array.isArray(value)
    ? value.map(object).filter((item): item is JsonObject => item !== null)
    : [];
}
function numberAt(data: JsonObject, key: string): number {
  return typeof data[key] === "number" ? data[key] : 0;
}
function stringAt(data: JsonObject, key: string): string {
  return typeof data[key] === "string" ? data[key] : "";
}
export async function loadLearningStatistics(
  supabase: SupabaseClient<Database>,
): Promise<LearningStatistics | null> {
  const { data, error } = await supabase.rpc("get_learning_statistics");
  const raw = object(data);
  if (error || !raw) return null;
  return {
    ...emptyStatistics,
    timezone: stringAt(raw, "timezone") || emptyStatistics.timezone,
    current_streak: numberAt(raw, "current_streak"),
    longest_streak: numberAt(raw, "longest_streak"),
    completed_today: raw.completed_today === true,
    total_completed_quizzes: numberAt(raw, "total_completed_quizzes"),
    questions_answered: numberAt(raw, "questions_answered"),
    correct_answers: numberAt(raw, "correct_answers"),
    active_days: numberAt(raw, "active_days"),
    last_active_date: stringAt(raw, "last_active_date") || null,
    daily_activity: objects(raw.daily_activity).map((item) => ({
      date: stringAt(item, "date"),
      active: item.active === true,
    })),
    mode_breakdown: objects(raw.mode_breakdown).map((item) => ({
      mode: stringAt(item, "mode"),
      quiz_count: numberAt(item, "quiz_count"),
      questions: numberAt(item, "questions"),
      correct: numberAt(item, "correct"),
    })),
    recent_quizzes: objects(raw.recent_quizzes).map((item) => ({
      id: stringAt(item, "id"),
      mode: stringAt(item, "mode"),
      completed_at: stringAt(item, "completed_at"),
      questions: numberAt(item, "questions"),
      correct: numberAt(item, "correct"),
    })),
  };
}

export async function loadMonthlyActivity(
  supabase: SupabaseClient<Database>,
  timezone: string,
  month: string,
): Promise<string[] | null> {
  const start = zonedMidnight(month + "-01", timezone);
  const end = zonedMidnight(`${addMonths(month, 1)}-01`, timezone);
  const { data, error } = await supabase
    .from("quiz_sessions")
    .select("completed_at")
    .not("completed_at", "is", null)
    .gte("completed_at", start.toISOString())
    .lt("completed_at", end.toISOString());
  if (error) return null;
  return Array.from(
    new Set(
      (data ?? []).flatMap((quiz) =>
        quiz.completed_at ? [dateInTimezone(new Date(quiz.completed_at), timezone)] : [],
      ),
    ),
  );
}

function zonedMidnight(date: string, timezone: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  const expected = Date.UTC(year, month - 1, day);
  let timestamp = expected;
  for (let index = 0; index < 3; index += 1) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(timestamp));
    const part = (type: Intl.DateTimeFormatPartTypes): number =>
      Number(parts.find((item) => item.type === type)?.value ?? 0);
    timestamp +=
      expected -
      Date.UTC(
        part("year"),
        part("month") - 1,
        part("day"),
        part("hour"),
        part("minute"),
        part("second"),
      );
  }
  return new Date(timestamp);
}
export function accuracy(correct: number, answers: number): number {
  return answers === 0 ? 0 : Math.round((correct / answers) * 100);
}
export function modeLabel(mode: string): string {
  return (
    {
      balanced: "Cân bằng",
      never_tested: "Chưa kiểm tra",
      wrong_answers: "Câu sai",
      pure_random: "Ngẫu nhiên",
    }[mode] ?? mode
  );
}
