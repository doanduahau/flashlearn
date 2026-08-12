import Link from "next/link";
import { Play } from "lucide-react";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { DashboardLearningStatus } from "@/features/dashboard/components/dashboard-learning-status";
import { countDueCards } from "@/features/spaced-repetition/server/due-repository";
import { countNewCards } from "@/features/spaced-repetition/server/new-cards-repository";
import { StartSmartReviewButton } from "@/features/smart-review/components/start-smart-review-button";
import { StartNewCardsButton } from "@/features/spaced-repetition/components/start-new-cards-button";
import { MonthActivityCalendar } from "@/features/statistics/components/month-activity-calendar";
import { SevenDayInsightCard } from "@/features/statistics/components/seven-day-insight-card";
import { loadSevenDayInsight } from "@/features/statistics/server/load-seven-day-insight";
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

  const evaluationTime = new Date().toISOString();
  const [todayDetail, monthActivity, streakDates, sevenDayInsight, claimsResult] =
    await Promise.all([
      loadActivityDetail(supabase, today),
      loadMonthlyActivity(supabase, currentMonth),
      loadMonthlyStreakDates(supabase, timezone, currentMonth),
      loadSevenDayInsight(supabase, today),
      supabase.auth.getClaims(),
    ]);

  const userId =
    typeof claimsResult.data?.claims?.sub === "string" ? claimsResult.data.claims.sub : null;

  let dueCount = 0;
  let newCardsCount = 0;
  let learningError = false;
  if (userId) {
    try {
      [dueCount, newCardsCount] = await Promise.all([
        countDueCards(supabase, userId, { type: "library" }, evaluationTime),
        countNewCards(supabase),
      ]);
    } catch (error) {
      console.error("[dashboard] unable to load learning counts", {
        name: error instanceof Error ? error.name : "unknown",
      });
      learningError = true;
    }
  }

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

      {learningError ? (
        <section
          role="alert"
          aria-label="Tóm tắt trạng thái học"
          className="mt-2 rounded-2xl border border-border-soft bg-surface px-3 py-2.5 text-sm text-danger sm:mt-3 sm:rounded-3xl sm:px-5 sm:py-3"
        >
          Không thể tải số thẻ cần ôn.
        </section>
      ) : dueCount > 0 || newCardsCount > 0 ? (
        <section aria-label="Tóm tắt trạng thái học" className="mt-2 sm:mt-3">
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-border-soft bg-surface px-3 py-2.5 sm:rounded-3xl sm:px-5 sm:py-3">
            <DashboardLearningStatus
              dueCount={dueCount}
              newCardsCount={newCardsCount}
              className="min-w-0"
            />
            <div className="flex shrink-0 items-center gap-2">
              {dueCount > 0 ? <StartSmartReviewButton /> : null}
              {newCardsCount > 0 ? <StartNewCardsButton /> : null}
            </div>
          </div>
        </section>
      ) : null}

      {sevenDayInsight ? (
        <div className="mt-2 sm:mt-3">
          <SevenDayInsightCard insight={sevenDayInsight} />
        </div>
      ) : null}

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
