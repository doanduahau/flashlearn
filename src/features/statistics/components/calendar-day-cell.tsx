"use client";

import { Flame } from "lucide-react";

import { cn } from "@/lib/utils";
import { monthDayLabel, type CalendarDay } from "@/features/statistics/utils/month-activity";

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
  isCoarse,
  isOpen,
  onTap,
  onDesktopMouseEnter,
  onDesktopMouseLeave,
  onDesktopFocus,
  onDesktopBlur,
}: Readonly<{
  day: CalendarDay;
  today: string;
  timezone: string;
  isCoarse: boolean;
  isOpen: boolean;
  onTap: () => void;
  onDesktopMouseEnter: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onDesktopMouseLeave: () => void;
  onDesktopFocus: (event: React.FocusEvent<HTMLButtonElement>) => void;
  onDesktopBlur: () => void;
}>) {
  const isToday = day.date === today;
  const shown = isCoarse && isOpen;
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
      onClick={onTap}
      aria-haspopup="dialog"
      aria-expanded={isCoarse ? shown : undefined}
      aria-label={`${monthDayLabel(day.date, timezone)}, ${stateLabel}`}
      disabled={day.future || !day.active}
      onMouseEnter={isCoarse ? undefined : onDesktopMouseEnter}
      onMouseLeave={isCoarse ? undefined : onDesktopMouseLeave}
      onFocus={isCoarse ? undefined : onDesktopFocus}
      onBlur={isCoarse ? undefined : onDesktopBlur}
      className={cn(
        "relative flex min-h-11 flex-col items-center justify-center rounded-xl border text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
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

      {/* Mobile coarse-pointer tap detail — rendered inline so it opens within the cell
          context (clipping/stacking is acceptable since the mobile sheet shows below the
          cell and other cells are not overlapping it on small viewports). */}
      {isCoarse && day.detail ? (
        <span
          role="dialog"
          aria-label="Chi tiết hoạt động"
          className={cn(
            "pointer-events-none absolute left-1/2 top-full z-30 mt-2 w-52 -translate-x-1/2 rounded-2xl border border-border-soft bg-surface p-3 text-left shadow-md transition-opacity duration-150",
            shown ? "visible opacity-100" : "invisible opacity-0",
          )}
        >
          <span className="block text-sm font-bold">{monthDayLabel(day.date, timezone)}</span>
          <span className="mt-1.5 block text-xs text-text-secondary">
            {day.detail.quizCount} bài kiểm tra · {day.detail.questions} câu
          </span>
          <span className="block text-xs text-text-secondary">
            {day.detail.correct} câu đúng · Độ chính xác{" "}
            {Math.round((day.detail.correct / day.detail.questions) * 100)}%
          </span>
        </span>
      ) : null}
    </button>
  );
}
