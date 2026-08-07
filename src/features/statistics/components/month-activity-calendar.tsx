import { ChevronLeft, ChevronRight, Flame } from "lucide-react";
import Link from "next/link";

import { addMonths, calendarDays, monthLabel } from "@/features/statistics/utils/month-activity";

const weekdays = ["Th 2", "Th 3", "Th 4", "Th 5", "Th 6", "Th 7", "CN"];

export function MonthActivityCalendar({
  month,
  currentMonth,
  timezone,
  activeDates,
  today,
  baseHref = "/profile?tab=statistics",
}: Readonly<{
  month: string;
  currentMonth: string;
  timezone: string;
  activeDates: string[];
  today: string;
  baseHref?: string;
}>) {
  const days = calendarDays(month, new Set(activeDates), today);
  const nextMonth = addMonths(month, 1);
  const previousMonth = addMonths(month, -1);
  const monthHref = (targetMonth: string): string =>
    `${baseHref}${baseHref.includes("?") ? "&" : "?"}month=${targetMonth}`;

  return (
    <section className="mt-8" aria-labelledby="activity-calendar-heading">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 id="activity-calendar-heading" className="text-xl font-bold">
            Hoạt động
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            Ngày có lửa là ngày đã hoàn thành bài kiểm tra.
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Link
            href={monthHref(previousMonth)}
            scroll={false}
            aria-label="Tháng trước"
            title="Tháng trước"
            className="inline-flex size-11 items-center justify-center rounded-xl border border-border-soft bg-surface hover:bg-surface-subtle focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronLeft aria-hidden="true" />
          </Link>
          {nextMonth > currentMonth ? (
            <span
              aria-label="Tháng sau chưa khả dụng"
              className="inline-flex size-11 items-center justify-center rounded-xl border border-border-soft bg-surface-subtle text-text-secondary"
            >
              <ChevronRight aria-hidden="true" />
            </span>
          ) : (
            <Link
              href={monthHref(nextMonth)}
              scroll={false}
              aria-label="Tháng sau"
              title="Tháng sau"
              className="inline-flex size-11 items-center justify-center rounded-xl border border-border-soft bg-surface hover:bg-surface-subtle focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronRight aria-hidden="true" />
            </Link>
          )}
        </div>
      </div>
      <p className="mt-3 text-center font-semibold capitalize">{monthLabel(month, timezone)}</p>
      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-xs sm:gap-2">
        {weekdays.map((weekday) => (
          <span key={weekday} className="py-1 font-medium text-text-secondary">
            {weekday}
          </span>
        ))}
        {days.map((day, index) => {
          if (day.day === null) return <span key={`blank-${index}`} aria-hidden="true" />;
          const label = new Intl.DateTimeFormat("vi-VN", {
            timeZone: timezone,
            day: "numeric",
            month: "long",
          }).format(new Date(`${day.date}T12:00:00Z`));
          const status = day.future
            ? "ngày trong tương lai"
            : day.active
              ? "có hoạt động"
              : "không có hoạt động";
          return (
            <div
              key={day.date}
              aria-label={`${label}, ${status}`}
              className={`flex min-h-11 flex-col items-center justify-center rounded-xl border text-xs ${
                day.date === today
                  ? "border-primary bg-primary-soft"
                  : day.future
                    ? "border-border-soft bg-surface-subtle text-text-secondary"
                    : "border-border-soft bg-surface"
              }`}
            >
              <span>{day.day}</span>
              {day.active ? (
                <Flame className="size-3.5 fill-warning text-warning" aria-hidden="true" />
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
