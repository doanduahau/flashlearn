import Link from "next/link";
import {
  accuracy,
  loadLearningStatistics,
  modeLabel,
} from "@/features/statistics/server/load-statistics";
import { createClient } from "@/lib/supabase/server";
export default async function StatisticsPage() {
  const stats = await loadLearningStatistics(await createClient());
  if (!stats)
    return (
      <main className="p-8">
        <h1 className="text-3xl font-bold">Thống kê</h1>
        <p role="alert" className="mt-4 text-danger">
          Không thể tải thống kê.
        </p>
      </main>
    );
  const cards = [
    ["Chuỗi hiện tại", `${stats.current_streak} ngày`],
    ["Chuỗi dài nhất", `${stats.longest_streak} ngày`],
    ["Hôm nay", stats.completed_today ? "Đã hoàn thành" : "Chưa hoàn thành"],
    ["Độ chính xác", `${accuracy(stats.correct_answers, stats.questions_answered)}%`],
    ["Bài đã hoàn thành", String(stats.total_completed_quizzes)],
    ["Ngày hoạt động", String(stats.active_days)],
  ];
  return (
    <main className="mx-auto w-full max-w-5xl p-4 sm:p-8">
      <h1 className="text-3xl font-bold">Thống kê học tập</h1>
      <p className="mt-2 text-text-secondary">
        Theo múi giờ {stats.timezone}. Chỉ bài kiểm tra đã hoàn thành được tính.
      </p>
      <section
        className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        aria-label="Tóm tắt thống kê"
      >
        {cards.map(([label, value]) => (
          <article className="rounded-2xl border border-border-soft bg-surface p-4" key={label}>
            <h2 className="text-sm text-text-secondary">{label}</h2>
            <p className="mt-1 text-2xl font-bold">{value}</p>
          </article>
        ))}
      </section>
      <section className="mt-8">
        <h2 className="text-xl font-bold">Hoạt động 30 ngày</h2>
        <div
          className="mt-3 grid grid-cols-5 gap-2 sm:grid-cols-10"
          aria-label="Hoạt động học tập trong 30 ngày"
        >
          {stats.daily_activity.map((day) => (
            <div
              className="rounded border border-border-soft p-2 text-center text-xs"
              key={day.date}
              aria-label={`${day.date}: ${day.active ? "đã học" : "chưa học"}`}
            >
              <span aria-hidden>{day.active ? "●" : "○"}</span>
              <span className="sr-only">{day.active ? "đã học" : "chưa học"}</span>
              <br />
              {day.date.slice(8)}
            </div>
          ))}
        </div>
      </section>
      <section className="mt-8">
        <h2 className="text-xl font-bold">Theo chế độ</h2>
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
        <h2 className="text-xl font-bold">Bài gần đây</h2>
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
    </main>
  );
}
