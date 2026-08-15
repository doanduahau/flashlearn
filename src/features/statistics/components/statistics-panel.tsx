import Link from "next/link";

import { MascotImage } from "@/features/mascot/components/mascot-image";
import { levelFromStreak } from "@/features/mascot/utils/mascot-level";
import type { MascotLevel } from "@/features/mascot/types/mascot-types";
import { MonthActivityCalendar } from "@/features/statistics/components/month-activity-calendar";
import {
  accuracy,
  loadLearningStatistics,
  loadMonthlyActivity,
  loadMonthlyStreakDates,
  modeLabel,
} from "@/features/statistics/server/load-statistics";
import {
  dateInTimezone,
  isValidMonth,
  monthInTimezone,
} from "@/features/statistics/utils/month-activity";
import { createClient } from "@/lib/supabase/server";

export async function StatisticsPanel({
  month: requestedMonthValue,
}: Readonly<{ month?: string | string[] }>) {
  const supabase = await createClient();
  const stats = await loadLearningStatistics(supabase);

  if (!stats) {
    return (
      <section className="mt-6" aria-labelledby="statistics-heading">
        <h2 id="statistics-heading" className="text-2xl font-bold">
          Thống kê học tập
        </h2>
        <p role="alert" className="mt-4 text-danger">
          Không thể tải thống kê.
        </p>
      </section>
    );
  }

  const currentMonth = monthInTimezone(new Date(), stats.timezone);
  const mascotLevel = levelFromStreak(stats.current_streak);
  const requestedMonth = typeof requestedMonthValue === "string" ? requestedMonthValue : "";
  const month =
    isValidMonth(requestedMonth) && requestedMonth <= currentMonth ? requestedMonth : currentMonth;
  const [monthActivity, streakDates] = await Promise.all([
    loadMonthlyActivity(supabase, month),
    loadMonthlyStreakDates(supabase, stats.timezone, month),
  ]);
  const today = dateInTimezone(new Date(), stats.timezone);
  const cards = [
    ["Chuỗi hiện tại", `${stats.current_streak} ngày`],
    ["Chuỗi dài nhất", `${stats.longest_streak} ngày`],
    ["Hôm nay", stats.completed_today ? "Đã hoàn thành" : "Chưa hoàn thành"],
    ["Độ chính xác", `${accuracy(stats.correct_answers, stats.questions_answered)}%`],
    ["Bài đã hoàn thành", String(stats.total_completed_quizzes)],
    ["Ngày hoạt động", String(stats.active_days)],
  ];

  return (
    <section className="mt-6" aria-labelledby="statistics-heading">
      <div className="flex items-center gap-3">
        <MascotImage
          level={mascotLevel}
          state="normal"
          size={64}
          className="size-16 object-contain"
        />
        <h2 id="statistics-heading" className="text-2xl font-bold">
          Thống kê học tập
        </h2>
      </div>
      <p className="mt-2 text-text-secondary">
        Theo múi giờ {stats.timezone}. Chỉ bài kiểm tra đã hoàn thành được tính.
      </p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Tóm tắt thống kê">
        {cards.map(([label, value]) => (
          <article className="rounded-2xl border border-border-soft bg-surface p-4" key={label}>
            <h3 className="text-sm text-text-secondary">{label}</h3>
            <p className="mt-1 text-2xl font-bold">{value}</p>
          </article>
        ))}
      </div>
      {monthActivity ? (
        <MonthActivityCalendar
          month={month}
          currentMonth={currentMonth}
          timezone={stats.timezone}
          details={monthActivity}
          streakDates={streakDates}
          today={today}
          variant="full"
          baseHref="/profile?tab=statistics"
        />
      ) : (
        <p role="alert" className="mt-8 text-danger">
          Không thể tải hoạt động tháng này.
        </p>
      )}
      <section className="mt-8">
        <h3 className="text-xl font-bold">Theo chế độ</h3>
        {stats.mode_breakdown.length ? (
          <ul className="mt-2 space-y-2">
            {stats.mode_breakdown.map((mode) => (
              <li className="rounded-xl border border-border-soft p-3" key={mode.mode}>
                {modeLabel(mode.mode)}: {mode.quiz_count} bài, {mode.correct}/{mode.questions} đúng
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-2 flex flex-col items-start gap-2 text-text-secondary">
            <MascotImage
              level={mascotLevel}
              state="thinking"
              size={64}
              className="size-16 object-contain"
            />
            <p>Chưa có bài hoàn thành.</p>
          </div>
        )}
      </section>
      <section className="mt-8">
        <h3 className="text-xl font-bold">Bài gần đây</h3>
        {stats.recent_quizzes.length ? (
          <ul className="mt-2 space-y-2">
            {stats.recent_quizzes.map((quiz) => (
              <li key={quiz.id}>
                <Link className="underline" href={`/quiz/${quiz.id}/result`}>
                  {modeLabel(quiz.mode)} · {quiz.correct}/{quiz.questions} đúng
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-text-secondary">Chưa có lịch sử để hiển thị.</p>
        )}
      </section>
      <QuizHistory supabase={supabase} mascotLevel={mascotLevel} />
    </section>
  );
}

async function QuizHistory({
  supabase,
  mascotLevel,
}: Readonly<{
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>;
  mascotLevel: MascotLevel;
}>) {
  const { data: sessions, error } = await supabase
    .from("quiz_sessions")
    .select("id, mode, actual_question_count, correct_answer_count, completed_at")
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false })
    .limit(50);

  return (
    <section className="mt-8" aria-labelledby="quiz-history-heading">
      <h3 id="quiz-history-heading" className="text-xl font-bold">
        Lịch sử bài kiểm tra
      </h3>
      {error ? (
        <p role="alert" className="mt-4 text-danger">
          Không thể tải lịch sử.
        </p>
      ) : sessions?.length ? (
        <ul className="mt-4 space-y-3">
          {sessions.map((session) => (
            <li key={session.id} className="rounded-2xl border border-border-soft bg-surface p-4">
              <Link className="font-semibold underline" href={`/quiz/${session.id}/result`}>
                {modeLabel(session.mode)} · {session.correct_answer_count}/
                {session.actual_question_count} đúng
              </Link>
              <p className="text-sm text-text-secondary">
                {session.completed_at ? new Date(session.completed_at).toLocaleString("vi-VN") : ""}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-4 flex flex-col items-start gap-2 text-text-secondary">
          <MascotImage
            level={mascotLevel}
            state="thinking"
            size={64}
            className="size-16 object-contain"
          />
          <p>Bạn chưa hoàn thành bài kiểm tra nào.</p>
        </div>
      )}
    </section>
  );
}
