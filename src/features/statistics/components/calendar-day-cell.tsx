"use client";

import { Flame } from "lucide-react";
import { useEffect, useRef, useState } from "react";

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
  const [open, setOpen] = useState(false);
  const cellRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointer(event: MouseEvent): void {
      if (cellRef.current && !cellRef.current.contains(event.target as Node)) setOpen(false);
    }
    function handleEscape(event: KeyboardEvent): void {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const isToday = day.date === today;
  const accuracy = dayAccuracy(day.detail);
  const status = day.future
    ? "ngày trong tương lai"
    : day.active
      ? "có hoạt động"
      : "không có hoạt động";

  return (
    <button
      ref={cellRef}
      type="button"
      onClick={() => setOpen((value) => !value)}
      aria-expanded={open}
      aria-haspopup="dialog"
      aria-label={`${monthDayLabel(day.date, timezone)}, ${status}`}
      disabled={day.future || !day.active}
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
          {isToday ? (
            <Flame className="size-3.5 fill-warning text-warning" aria-hidden="true" />
          ) : (
            <span className="size-1.5 rounded-full bg-primary/50" aria-hidden="true" />
          )}
        </span>
      ) : null}

      {open && day.detail ? (
        <div
          role="dialog"
          aria-label="Chi tiết hoạt động"
          className="absolute left-1/2 top-full z-20 mt-2 w-52 -translate-x-1/2 rounded-2xl border border-border-soft bg-surface p-3 text-left shadow-md"
        >
          <p className="text-sm font-bold">{monthDayLabel(day.date, timezone)}</p>
          <p className="mt-1.5 text-xs text-text-secondary">
            {day.detail.quizCount} bài kiểm tra · {day.detail.questions} câu
          </p>
          <p className="text-xs text-text-secondary">
            {day.detail.correct} câu đúng · Độ chính xác {accuracy ?? 0}%
          </p>
        </div>
      ) : null}
    </button>
  );
}
