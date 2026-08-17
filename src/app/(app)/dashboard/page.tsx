import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { OfflineBanner } from "@/components/shared/offline-banner";
import { DashboardMotivationBar } from "@/features/dashboard/components/dashboard-motivation-bar";
import { DashboardLearningStatus } from "@/features/dashboard/components/dashboard-learning-status";
import { StreakMilestoneBanner } from "@/features/dashboard/components/streak-milestone-banner";
import { loadMascotLevel } from "@/features/mascot/server/load-mascot-level";
import { StartSmartReviewButton } from "@/features/smart-review/components/start-smart-review-button";
import { StartNewCardsButton } from "@/features/spaced-repetition/components/start-new-cards-button";
import { MonthActivityCalendar } from "@/features/statistics/components/month-activity-calendar";
import {
  accuracy,
  loadActivityDetail,
  loadMonthlyActivity,
  loadMonthlyStreakDates,
} from "@/features/statistics/server/load-statistics";
import { loadCachedStreakSummary } from "@/features/statistics/server/load-cached-statistics";
import {
  addMonths,
  dateInTimezone,
  isValidMonth,
  isValidTimezone,
  monthInTimezone,
} from "@/features/statistics/utils/month-activity";
import { createClient } from "@/lib/supabase/server";

const DEFAULT_TIMEZONE = "Asia/Ho_Chi_Minh";

export default async function DashboardPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ create?: string | string[]; month?: string | string[] }> }>) {
  const raw = await searchParams;
  if (raw.create === "import") redirect("/sets/create?source=file");
  if (raw.create === "manual") redirect("/sets/create?source=manual");

  const supabase = await createClient();
  const profileResult = await supabase.from("profiles").select("timezone").maybeSingle();
  let timezone = profileResult.data?.timezone ?? DEFAULT_TIMEZONE;
  if (!isValidTimezone(timezone)) timezone = DEFAULT_TIMEZONE;

  const today = dateInTimezone(new Date(), timezone);
  const currentMonth = monthInTimezone(new Date(), timezone);
  const requestedMonth = typeof raw.month === "string" ? raw.month : "";
  const month =
    isValidMonth(requestedMonth) && requestedMonth <= currentMonth ? requestedMonth : currentMonth;
  const previousMonth = addMonths(month, -1);
  const nextMonth = addMonths(month, 1);

  const [todayDetail, monthActivity, streakDates, claimsResult, mascotLevel, streakSummary] =
    await Promise.all([
      loadActivityDetail(supabase, today),
      loadMonthlyActivity(supabase, month),
      loadMonthlyStreakDates(supabase, timezone, month),
      supabase.auth.getClaims(),
      loadMascotLevel(supabase),
      loadCachedStreakSummary(supabase),
    ]);

  const userId =
    typeof claimsResult.data?.claims?.sub === "string" ? claimsResult.data.claims.sub : null;

  let dueCount = 0;
  let newCardsCount = 0;
  let learningError = false;
  if (userId) {
    try {
      const { data: counts, error: countsError } = await supabase.rpc("get_dashboard_counts");
      if (countsError) throw countsError;
      const first = Array.isArray(counts) ? counts[0] : counts;
      // "Cần ôn" = cards whose latest answer is wrong in any quiz mode;
      // "Chưa học" = cards never seen in any mode. The smart-review/new-cards
      // buttons keep their existing behavior but only render with a matching
      // count so the numbers and actions stay consistent.
      dueCount = first?.due_count ?? 0;
      newCardsCount = first?.untouched_count ?? 0;
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

  return (
    <main className="mx-auto w-full max-w-5xl p-3 sm:p-8">
      <OfflineBanner />
      <h1 className="text-2xl font-bold sm:text-3xl">Tổng quan</h1>

      <DashboardMotivationBar
        completedToday={completedToday}
        recoverable={streakSummary?.recoverable ?? false}
        needsRecoveryQuizzes={streakSummary?.needsRecoveryQuizzes ?? 0}
        mascotLevel={mascotLevel}
      />
      <StreakMilestoneBanner streak={streakSummary?.currentStreak ?? 0} />

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
            <div className="flex shrink-0 flex-col justify-center gap-2">
              {dueCount > 0 ? <StartSmartReviewButton /> : null}
              {newCardsCount > 0 ? <StartNewCardsButton /> : null}
            </div>
          </div>
        </section>
      ) : null}

      {monthActivity ? (
        <div className="mt-3 rounded-2xl border border-border-soft bg-surface p-3 sm:mt-4 sm:rounded-3xl sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-bold sm:text-lg">Hoạt động tháng này</h2>
            <div className="flex items-center gap-1">
              <Link
                href={`/dashboard?month=${previousMonth}`}
                scroll={false}
                aria-label="Tháng trước"
                title="Tháng trước"
                className="inline-flex size-8 items-center justify-center rounded-lg border border-border-soft bg-surface hover:bg-surface-subtle focus-visible:ring-2 focus-visible:ring-ring sm:size-9"
              >
                <ChevronLeft className="size-4" aria-hidden="true" />
              </Link>
              {nextMonth > currentMonth ? (
                <span
                  aria-label="Tháng sau chưa khả dụng"
                  className="inline-flex size-8 items-center justify-center rounded-lg border border-border-soft bg-surface-subtle text-text-secondary opacity-40 sm:size-9"
                >
                  <ChevronRight className="size-4" aria-hidden="true" />
                </span>
              ) : (
                <Link
                  href={`/dashboard?month=${nextMonth}`}
                  scroll={false}
                  aria-label="Tháng sau"
                  title="Tháng sau"
                  className="inline-flex size-8 items-center justify-center rounded-lg border border-border-soft bg-surface hover:bg-surface-subtle focus-visible:ring-2 focus-visible:ring-ring sm:size-9"
                >
                  <ChevronRight className="size-4" aria-hidden="true" />
                </Link>
              )}
            </div>
          </div>
          <MonthActivityCalendar
            month={month}
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
