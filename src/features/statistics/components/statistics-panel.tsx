import Link from "next/link";

import { MascotImage } from "@/features/mascot/components/mascot-image";
import { levelFromStreak } from "@/features/mascot/utils/mascot-level";
import { MonthActivityCalendar } from "@/features/statistics/components/month-activity-calendar";
import {
  accuracy,
  loadLearningStatistics,
  loadMergedHistory,
  loadMonthlyActivity,
  loadMonthlyStreakDates,
} from "@/features/statistics/server/load-statistics";
import {
  dateInTimezone,
  isValidMonth,
  monthInTimezone,
} from "@/features/statistics/utils/month-activity";
import { createClient } from "@/lib/supabase/server";

export async function StatisticsPanel({
  month: requestedMonthValue,
  view: requestedViewValue,
}: Readonly<{
  month?: string | string[];
  view?: string | string[];
}>) {
  const supabase = await createClient();
  const isHistoryView =
    typeof requestedViewValue === "string"
      ? requestedViewValue === "history"
      : Array.isArray(requestedViewValue) && requestedViewValue.includes("history");

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

  const mascotLevel = levelFromStreak(stats.current_streak);

  if (isHistoryView) {
    const history = await loadMergedHistory(supabase);
    return (
      <section className="mt-6" aria-labelledby="history-heading">
        <div className="flex items-center justify-between gap-4">
          <h2 id="history-heading" className="text-2xl font-bold">
            Lịch sử
          </h2>
          <Link
            href="/profile?tab=statistics"
            className="text-sm font-medium text-text-secondary hover:underline"
          >
            &larr; Quay lại
          </Link>
        </div>
        {history.length ? (
          <ul className="mt-4 space-y-3">
            {history.map((item) => (
              <li
                key={`${item.type}-${item.id}`}
                className="flex items-center justify-between rounded-2xl border border-border-soft bg-surface p-4"
              >
                <div>
                  {item.type === "quiz" ? (
                    <Link className="font-semibold underline" href={`/quiz/${item.id}/result`}>
                      {item.correct}/{item.total} đúng
                    </Link>
                  ) : (
                    <span className="font-semibold">
                      {item.correct}/{item.total} đúng
                    </span>
                  )}
                  <p className="mt-0.5 text-xs text-text-secondary">
                    {new Date(item.completedAt).toLocaleString("vi-VN")}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-6 flex flex-col items-center gap-3 py-8 text-center text-text-secondary">
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

  const currentMonth = monthInTimezone(new Date(), stats.timezone);
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
      <div className="mt-6 grid grid-cols-2 gap-2 sm:gap-3" aria-label="Tóm tắt thống kê">
        {cards.map(([label, value]) => (
          <article
            className="rounded-2xl border border-border-soft bg-surface p-3 sm:p-4"
            key={label}
          >
            <h3 className="text-xs text-text-secondary sm:text-sm">{label}</h3>
            <p className="mt-1 text-base font-bold sm:text-lg">{value}</p>
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
      <section
        aria-labelledby="history-summary-heading"
        className="mt-8 flex items-center justify-between gap-4 rounded-2xl border border-border-soft bg-surface p-4"
      >
        <div>
          <h3 id="history-summary-heading" className="font-semibold text-text-primary">
            Lịch sử
          </h3>
          <p className="mt-0.5 text-xs text-text-secondary">
            Tất cả bài trắc nghiệm, ghép thẻ và gõ từ đã hoàn thành
          </p>
        </div>
        <Link
          href="/profile?tab=statistics&view=history"
          className="shrink-0 text-sm font-semibold text-primary hover:underline"
        >
          Xem lịch sử &rarr;
        </Link>
      </section>
    </section>
  );
}
