import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/types";
import {
  addMonths,
  dateInTimezone,
  isValidTimezone,
  type DailyActivityDetail,
} from "@/features/statistics/utils/month-activity";
import { computeStreakRun, computeStreaks } from "@/features/statistics/utils/streak";

export type { DailyActivityDetail } from "@/features/statistics/utils/month-activity";

export type DailyActivity = { date: string; active: boolean };
export type StreakSummary = {
  timezone: string;
  currentStreak: number;
  longestStreak: number;
  completedToday: boolean;
};
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
  month: string,
): Promise<DailyActivityDetail[] | null> {
  const start = `${month}-01`;
  const end = `${addMonths(month, 1)}-01`;
  const { data, error } = await supabase
    .from("daily_learning_records")
    .select("local_date, completed_quiz_count, questions_answered, correct_answers")
    .gte("local_date", start)
    .lt("local_date", end);
  if (error) return null;
  return (data ?? []).map((record) => ({
    date: record.local_date,
    quizCount: record.completed_quiz_count,
    questions: record.questions_answered,
    correct: record.correct_answers,
  }));
}

export async function loadActivityDetail(
  supabase: SupabaseClient<Database>,
  date: string,
): Promise<DailyActivityDetail | null> {
  const { data, error } = await supabase
    .from("daily_learning_records")
    .select("local_date, completed_quiz_count, questions_answered, correct_answers")
    .eq("local_date", date)
    .maybeSingle();
  if (error || !data) return null;
  return {
    date: data.local_date,
    quizCount: data.completed_quiz_count,
    questions: data.questions_answered,
    correct: data.correct_answers,
  };
}

const DEFAULT_TIMEZONE = "Asia/Ho_Chi_Minh";

export async function loadMonthlyStreakDates(
  supabase: SupabaseClient<Database>,
  timezone: string,
  month: string,
): Promise<string[]> {
  const datesResult = await supabase.from("daily_learning_records").select("local_date");
  if (datesResult.error || !datesResult.data) return [];
  const today = dateInTimezone(new Date(), timezone);
  const run = computeStreakRun(
    datesResult.data.map((record) => record.local_date),
    today,
  );
  return run.filter((date) => date.startsWith(`${month}-`));
}

export async function loadStreakSummary(
  supabase: SupabaseClient<Database>,
): Promise<StreakSummary | null> {
  const [profileResult, datesResult] = await Promise.all([
    supabase.from("profiles").select("timezone").maybeSingle(),
    supabase.from("daily_learning_records").select("local_date"),
  ]);
  if (datesResult.error) return null;

  let timezone = profileResult.data?.timezone ?? DEFAULT_TIMEZONE;
  if (!isValidTimezone(timezone)) timezone = DEFAULT_TIMEZONE;
  const today = dateInTimezone(new Date(), timezone);
  const streaks = computeStreaks(datesResult.data?.map((record) => record.local_date) ?? [], today);

  return {
    timezone,
    currentStreak: streaks.current,
    longestStreak: streaks.longest,
    completedToday: streaks.completedToday,
  };
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

export type MergedHistoryItem = {
  id: string;
  type: "quiz" | "match" | "typing";
  correct: number;
  total: number;
  completedAt: string;
};

export async function loadMergedHistory(
  supabase: SupabaseClient<Database>,
  limit = 50,
): Promise<MergedHistoryItem[]> {
  const [quizRes, matchRes, typingRes] = await Promise.all([
    supabase
      .from("quiz_sessions")
      .select("id, actual_question_count, correct_answer_count, completed_at")
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false })
      .limit(limit),
    supabase
      .from("match_attempts")
      .select("id, total_pairs, correct_pair_count, completed_at")
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false })
      .limit(limit),
    supabase
      .from("typing_attempts")
      .select("id, total_questions, correct_questions, completed_at")
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false })
      .limit(limit),
  ]);

  const items: MergedHistoryItem[] = [];

  if (quizRes.data) {
    for (const q of quizRes.data) {
      if (q.completed_at) {
        items.push({
          id: q.id,
          type: "quiz",
          correct: q.correct_answer_count,
          total: q.actual_question_count,
          completedAt: q.completed_at,
        });
      }
    }
  }

  if (matchRes.data) {
    for (const m of matchRes.data) {
      if (m.completed_at) {
        items.push({
          id: m.id,
          type: "match",
          correct: m.correct_pair_count,
          total: m.total_pairs,
          completedAt: m.completed_at,
        });
      }
    }
  }

  if (typingRes.data) {
    for (const t of typingRes.data) {
      if (t.completed_at) {
        items.push({
          id: t.id,
          type: "typing",
          correct: t.correct_questions,
          total: t.total_questions,
          completedAt: t.completed_at,
        });
      }
    }
  }

  items.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());

  return items.slice(0, limit);
}
