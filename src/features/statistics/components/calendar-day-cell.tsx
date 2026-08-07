import { Flame } from "lucide-react";

import { cn } from "@/lib/utils";
import { monthDayLabel, type CalendarDay } from "@/features/statistics/utils/month-activity";

function dayAccuracy(detail: CalendarDay["detail"]): number | null {
  if (!detail || detail.questions === 0) return null;
  return Math.round((detail.correct / detail.questions) * 100);
}

const quizLevelClasses: Record<CalendarDay["quizLevel"], string> = {
  0: "border-border-soft bg-surface",
  1: "border-primary-soft bg-primary-soft",
  2: "border-primary/40 bg-primary/15",
  3: "border-primary bg-primary/30",
};

export function CalendarDayCell({
  day,
  today,
  timezone,
}: Readonly<{ day: CalendarDay; today: string; timezone: string }>) {
  const isToday = day.date === today;
  const accuracy = dayAccuracy(day.detail);
  const stateLabel = day.future
    ? "ngày trong tương lai"
    : day.active
      ? day.flame
        ? "có hoạt động, thuộc chuỗi học tập"
        : "có hoạt động"
      : "không có hoạt động";

  return (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-label={`${monthDayLabel(day.date, timezone)}, ${stateLabel}`}
      disabled={day.future || !day.active}
      className={cn(
        "group relative flex min-h-11 flex-col items-center justify-center rounded-xl border text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
        isToday
          ? "border-primary ring-1 ring-primary/60"
          : day.future
            ? "border-border-soft bg-surface-subtle text-text-secondary"
            : quizLevelClasses[day.quizLevel],
        day.active && !day.future ? "cursor-pointer hover:brightness-95" : "cursor-default",
      )}
    >
      <span className={cn(day.future || !day.active ? "text-text-secondary" : "text-text-primary")}>
        {day.day}
      </span>
      {day.active ? (
        <span className="flex h-3.5 items-center justify-center">
          {day.flame ? (
            <Flame className="size-3.5 fill-warning text-warning" aria-hidden="true" />
          ) : (
            <span className="size-1.5 rounded-full bg-primary/50" aria-hidden="true" />
          )}
        </span>
      ) : null}

      {day.detail ? (
        <span
          role="dialog"
          aria-label="Chi tiết hoạt động"
          className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 w-52 -translate-x-1/2 rounded-2xl border border-border-soft bg-surface p-3 text-left shadow-md invisible opacity-0 transition-opacity duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
        >
          <span className="block text-sm font-bold">{monthDayLabel(day.date, timezone)}</span>
          <span className="mt-1.5 block text-xs text-text-secondary">
            {day.detail.quizCount} bài kiểm tra · {day.detail.questions} câu
          </span>
          <span className="block text-xs text-text-secondary">
            {day.detail.correct} câu đúng · Độ chính xác {accuracy ?? 0}%
          </span>
        </span>
      ) : null}
    </button>
  );
}
