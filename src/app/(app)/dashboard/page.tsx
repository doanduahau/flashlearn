import Link from "next/link";
import { FileUp, Play, SquarePen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ManualSetForm } from "@/features/flashcard-sets/components/manual-set-form";
import { ImportWizard } from "@/features/imports/components/import-wizard";
import { MonthActivityCalendar } from "@/features/statistics/components/month-activity-calendar";
import {
  accuracy,
  loadActivityDetail,
  loadMonthlyActivity,
} from "@/features/statistics/server/load-statistics";
import {
  dateInTimezone,
  isValidTimezone,
  monthInTimezone,
} from "@/features/statistics/utils/month-activity";
import { createClient } from "@/lib/supabase/server";

const DEFAULT_TIMEZONE = "Asia/Ho_Chi_Minh";

type CreationMode = "import" | "manual" | null;

function creationMode(value: string | string[] | undefined): CreationMode {
  return value === "import" || value === "manual" ? value : null;
}

export default async function DashboardPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ create?: string | string[] }> }>) {
  const supabase = await createClient();
  const profileResult = await supabase.from("profiles").select("timezone").maybeSingle();
  let timezone = profileResult.data?.timezone ?? DEFAULT_TIMEZONE;
  if (!isValidTimezone(timezone)) timezone = DEFAULT_TIMEZONE;

  const today = dateInTimezone(new Date(), timezone);
  const currentMonth = monthInTimezone(new Date(), timezone);

  const [todayDetail, monthActivity] = await Promise.all([
    loadActivityDetail(supabase, today),
    loadMonthlyActivity(supabase, currentMonth),
  ]);

  const completedToday = todayDetail !== null;
  const todayAccuracy =
    todayDetail && todayDetail.questions > 0
      ? accuracy(todayDetail.correct, todayDetail.questions)
      : null;

  const raw = await searchParams;
  const mode = creationMode(raw.create);

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

      <section className="mt-6 grid gap-3 sm:grid-cols-2" aria-label="Tóm tắt hôm nay">
        <article className="rounded-2xl border border-border-soft bg-surface p-4">
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
        <article className="rounded-2xl border border-border-soft bg-surface p-4">
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
        <div className="mt-6 rounded-3xl border border-border-soft bg-surface p-5 sm:p-6">
          <h2 className="text-lg font-bold">Hoạt động tháng này</h2>
          <MonthActivityCalendar
            month={currentMonth}
            currentMonth={currentMonth}
            timezone={timezone}
            details={monthActivity}
            today={today}
            variant="compact"
          />
        </div>
      ) : (
        <p
          role="alert"
          className="mt-6 rounded-2xl border border-border-soft bg-surface p-4 text-danger"
        >
          Không thể tải hoạt động tháng này.
        </p>
      )}

      <section
        aria-labelledby="creation-heading"
        className="mt-8 rounded-3xl border border-border-soft bg-surface-subtle p-5 sm:p-6"
      >
        <h2 id="creation-heading" className="text-xl font-bold">
          Tạo bộ flashcard
        </h2>
        <p className="mt-1 text-text-secondary">Chọn cách bắt đầu phù hợp với nội dung của bạn.</p>
        {!mode ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Button asChild className="min-h-11">
              <Link href="/dashboard?create=import" scroll={false}>
                <FileUp aria-hidden="true" />
                Nhập từ tệp
              </Link>
            </Button>
            <Button asChild variant="outline" className="min-h-11">
              <Link href="/dashboard?create=manual" scroll={false}>
                <SquarePen aria-hidden="true" />
                Tạo bộ thủ công
              </Link>
            </Button>
          </div>
        ) : null}
        {mode === "import" ? (
          <section
            aria-label="Nhập từ tệp"
            className="mt-5 rounded-2xl border border-border-soft bg-surface p-5"
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold">Nhập từ tệp</h3>
              <Link className="text-sm underline" href="/dashboard" scroll={false}>
                Đóng
              </Link>
            </div>
            <div className="mt-4">
              <ImportWizard />
            </div>
          </section>
        ) : null}
        {mode === "manual" ? <ManualSetForm /> : null}
      </section>

      <Link className="mt-6 inline-block underline" href="/profile?tab=statistics">
        Xem thống kê chi tiết
      </Link>
    </main>
  );
}
