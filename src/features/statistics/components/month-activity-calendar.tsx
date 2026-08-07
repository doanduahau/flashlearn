import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

import { CalendarDayCell } from "@/features/statistics/components/calendar-day-cell";
import {
  addMonths,
  calendarDays,
  monthLabel,
  type DailyActivityDetail,
} from "@/features/statistics/utils/month-activity";

const weekdays = ["Th 2", "Th 3", "Th 4", "Th 5", "Th 6", "Th 7", "CN"];

export function MonthActivityCalendar({
  month,
  currentMonth,
  timezone,
  details,
  today,
  baseHref = "/profile?tab=statistics",
  variant = "full",
}: Readonly<{
  month: string;
  currentMonth: string;
  timezone: string;
  details: DailyActivityDetail[];
  today: string;
  baseHref?: string;
  variant?: "full" | "compact";
}>) {
  const detailMap = new Map(details.map((item) => [item.date, item]));
  const days = calendarDays(month, detailMap, today);
  const nextMonth = addMonths(month, 1);
  const previousMonth = addMonths(month, -1);
  const monthHref = (targetMonth: string): string =>
    `${baseHref}${baseHref.includes("?") ? "&" : "?"}month=${targetMonth}`;

  return (
    <section className={variant === "compact" ? "" : "mt-8"} aria-label="Lịch hoạt động">
      {variant === "full" ? (
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 id="activity-calendar-heading" className="text-xl font-bold">
              Hoạt động
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              Chạm vào một ngày để xem chi tiết hoạt động hôm đó.
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
      ) : null}
      <p
        className={
          variant === "full" ? "mt-3 text-center font-semibold capitalize" : "mt-3 font-semibold"
        }
      >
        {monthLabel(month, timezone)}
      </p>
      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-xs sm:gap-2">
        {weekdays.map((weekday) => (
          <span key={weekday} className="py-1 font-medium text-text-secondary">
            {weekday}
          </span>
        ))}
        {days.map((day, index) => {
          if (day.day === null) return <span key={`blank-${index}`} aria-hidden="true" />;
          return <CalendarDayCell key={day.date} day={day} today={today} timezone={timezone} />;
        })}
      </div>
    </section>
  );
}
