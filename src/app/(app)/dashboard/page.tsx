import Link from "next/link";
import { accuracy, loadLearningStatistics } from "@/features/statistics/server/load-statistics";
import { StreakSummary } from "@/features/statistics/components/streak-summary";
import { createClient } from "@/lib/supabase/server";
export default async function DashboardPage() {
  const stats = await loadLearningStatistics(await createClient());
  return (
    <main className="mx-auto w-full max-w-5xl p-4 sm:p-8">
      <h1 className="text-3xl font-bold">Tổng quan</h1>
      {stats ? (
        <section className="mt-6 grid gap-3 sm:grid-cols-3" aria-label="Tóm tắt học tập">
          <StreakSummary streak={stats.current_streak} completedToday={stats.completed_today} />
          <article className="rounded-2xl border border-border-soft p-4">
            <h2 className="text-sm text-text-secondary">Mục tiêu hôm nay</h2>
            <p className="text-2xl font-bold">{stats.completed_today ? "Đã xong" : "Chưa xong"}</p>
          </article>
          <article className="rounded-2xl border border-border-soft p-4">
            <h2 className="text-sm text-text-secondary">Độ chính xác</h2>
            <p className="text-2xl font-bold">
              {accuracy(stats.correct_answers, stats.questions_answered)}%
            </p>
          </article>
        </section>
      ) : null}
      <Link className="mt-6 inline-block underline" href="/statistics">
        Xem thống kê chi tiết
      </Link>
    </main>
  );
}
