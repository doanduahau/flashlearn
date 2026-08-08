import Link from "next/link";
import { Play } from "lucide-react";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { MonthActivityCalendar } from "@/features/statistics/components/month-activity-calendar";
import {
  accuracy,
  loadActivityDetail,
  loadMonthlyActivity,
  loadMonthlyStreakDates,
} from "@/features/statistics/server/load-statistics";
import {
  dateInTimezone,
  isValidTimezone,
  monthInTimezone,
} from "@/features/statistics/utils/month-activity";
import { createClient } from "@/lib/supabase/server";

const DEFAULT_TIMEZONE = "Asia/Ho_Chi_Minh";

export default async function DashboardPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ create?: string | string[] }> }>) {
  const supabase = await createClient();
  const profileResult = await supabase.from("profiles").select("timezone").maybeSingle();
  let timezone = profileResult.data?.timezone ?? DEFAULT_TIMEZONE;
  if (!isValidTimezone(timezone)) timezone = DEFAULT_TIMEZONE;

  const today = dateInTimezone(new Date(), timezone);
  const currentMonth = monthInTimezone(new Date(), timezone);

  const [todayDetail, monthActivity, streakDates] = await Promise.all([
    loadActivityDetail(supabase, today),
    loadMonthlyActivity(supabase, currentMonth),
    loadMonthlyStreakDates(supabase, timezone, currentMonth),
  ]);

  const completedToday = todayDetail !== null;
  const todayAccuracy =
    todayDetail && todayDetail.questions > 0
      ? accuracy(todayDetail.correct, todayDetail.questions)
      : null;

  const raw = await searchParams;
  if (raw.create === "import") redirect("/sets?create=import");
  if (raw.create === "manual") redirect("/sets?create=manual");

  return (
    <main className="mx-auto w-full max-w-5xl p-3 sm:p-8">
      <h1 className="text-2xl font-bold sm:text-3xl">Tổng quan</h1>

      {/* Compact motivation row */}
      <section
        aria-labelledby="daily-motivation-heading"
        className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-border-soft bg-surface-subtle px-3 py-2.5 sm:mt-5 sm:rounded-3xl sm:px-5 sm:py-4"
      >
        <h2 id="daily-motivation-heading" className="text-sm font-semibold sm:text-base">
          {completedToday ? "Đã nối chuỗi hôm nay! 🎉" : "Chưa làm bài hôm nay"}
        </h2>
        <Button asChild size="sm" className="shrink-0">
          <Link href="/quiz?tab=create">
            <Play aria-hidden="true" />
            <span className="hidden sm:inline">{completedToday ? "Tiếp tục" : "Bắt đầu"}</span>
            <span className="sm:hidden">{completedToday ? "Luyện tập" : "Kiểm tra"}</span>
          </Link>
        </Button>
      </section>

      {/* Stat cards — always 2-col */}
      <section
        className="mt-2 grid grid-cols-2 gap-2 sm:mt-3 sm:gap-3"
        aria-label="Tóm tắt hôm nay"
      >
        <article className="rounded-xl border border-border-soft bg-surface p-2.5 sm:rounded-2xl sm:p-4">
          <h2 className="text-xs text-text-secondary sm:text-sm">Độ chính xác</h2>
          <p className="mt-0.5 text-xl font-bold sm:mt-1 sm:text-2xl">
            {completedToday && todayAccuracy !== null ? `${todayAccuracy}%` : "—"}
          </p>
          {completedToday && (
            <p className="mt-0.5 text-xs text-text-secondary">
              {todayDetail.correct}/{todayDetail.questions} đúng
            </p>
          )}
        </article>
        <article className="rounded-xl border border-border-soft bg-surface p-2.5 sm:rounded-2xl sm:p-4">
          <h2 className="text-xs text-text-secondary sm:text-sm">Bài hôm nay</h2>
          <p className="mt-0.5 text-xl font-bold sm:mt-1 sm:text-2xl">
            {completedToday ? String(todayDetail.quizCount) : "0"}
          </p>
          {completedToday && <p className="mt-0.5 text-xs text-text-secondary">Đã hoàn thành</p>}
        </article>
      </section>

      {/* Monthly calendar — primary content */}
      {monthActivity ? (
        <div className="mt-3 rounded-2xl border border-border-soft bg-surface p-3 sm:mt-4 sm:rounded-3xl sm:p-6">
          <h2 className="text-base font-bold sm:text-lg">Hoạt động tháng này</h2>
          <MonthActivityCalendar
            month={currentMonth}
            currentMonth={currentMonth}
            timezone={timezone}
            details={monthActivity}
            streakDates={streakDates}
            today={today}
            variant="compact"
          />
        </div>
      ) : (
        <p
          role="alert"
          className="mt-3 rounded-2xl border border-border-soft bg-surface p-3 text-danger sm:mt-4 sm:p-4"
        >
          Không thể tải hoạt động tháng này.
        </p>
      )}

      <Link className="mt-4 inline-block text-sm underline sm:mt-6" href="/profile?tab=statistics">
        Xem thống kê chi tiết
      </Link>
    </main>
  );
}
