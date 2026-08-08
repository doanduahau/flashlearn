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
    <main className="mx-auto w-full max-w-5xl p-4 sm:p-8">
      <h1 className="text-3xl font-bold">Tổng quan</h1>

      <section
        aria-labelledby="daily-motivation-heading"
        className="mt-6 rounded-3xl border border-border-soft bg-surface-subtle p-5 sm:p-6"
      >
        <h2 id="daily-motivation-heading" className="text-lg font-bold">
          {completedToday
            ? "Bạn đã nối chuỗi hôm nay!"
            : "Hãy làm 1 bài kiểm tra để nối chuỗi học tập nào!"}
        </h2>
        <p className="mt-1 text-text-secondary">
          {completedToday
            ? "Tiếp tục luyện tập chứ?"
            : "Mỗi bài kiểm tra hoàn thành trong ngày giúp giữ vững chuỗi học tập của bạn."}
        </p>
        <Button asChild className="mt-4 min-h-11">
          <Link href="/quiz?tab=create">
            <Play aria-hidden="true" />
            {completedToday ? "Tiếp tục luyện tập" : "Bắt đầu bài kiểm tra"}
          </Link>
        </Button>
      </section>

      <section className="mt-4 grid gap-3 sm:grid-cols-2" aria-label="Tóm tắt hôm nay">
        <article className="rounded-2xl border border-border-soft bg-surface p-3 sm:p-4">
          <h2 className="text-sm text-text-secondary">Độ chính xác hôm nay</h2>
          <p className="mt-1 text-2xl font-bold">
            {completedToday && todayAccuracy !== null ? `${todayAccuracy}%` : "—"}
          </p>
          <p className="mt-1 text-xs text-text-secondary">
            {completedToday
              ? `${todayDetail.questions} câu · ${todayDetail.correct} câu đúng`
              : "Chưa có bài hôm nay."}
          </p>
        </article>
        <article className="rounded-2xl border border-border-soft bg-surface p-3 sm:p-4">
          <h2 className="text-sm text-text-secondary">Bài kiểm tra hôm nay</h2>
          <p className="mt-1 text-2xl font-bold">
            {completedToday ? String(todayDetail.quizCount) : "0"}
          </p>
          <p className="mt-1 text-xs text-text-secondary">
            {completedToday ? "Đã hoàn thành" : "Chưa hoàn thành bài nào."}
          </p>
        </article>
      </section>

      {monthActivity ? (
        <div className="mt-4 rounded-3xl border border-border-soft bg-surface p-5 sm:p-6">
          <h2 className="text-lg font-bold">Hoạt động tháng này</h2>
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
          className="mt-4 rounded-2xl border border-border-soft bg-surface p-4 text-danger"
        >
          Không thể tải hoạt động tháng này.
        </p>
      )}

      <Link className="mt-6 inline-block underline" href="/profile?tab=statistics">
        Xem thống kê chi tiết
      </Link>
    </main>
  );
}
