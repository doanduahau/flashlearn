import Link from "next/link";

import { MonthActivityCalendar } from "@/features/statistics/components/month-activity-calendar";
import {
  accuracy,
  loadLearningStatistics,
  loadMonthlyActivity,
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
  const requestedMonth = typeof requestedMonthValue === "string" ? requestedMonthValue : "";
  const month =
    isValidMonth(requestedMonth) && requestedMonth <= currentMonth ? requestedMonth : currentMonth;
  const monthActivity = await loadMonthlyActivity(supabase, month);
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
      <h2 id="statistics-heading" className="text-2xl font-bold">
        Thống kê học tập
      </h2>
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
          <p className="mt-2 text-text-secondary">Chưa có bài hoàn thành.</p>
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
    </section>
  );
}
