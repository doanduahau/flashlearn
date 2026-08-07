"use client";

import { useEffect, useRef, useState } from "react";

import { CalendarDayCell } from "@/features/statistics/components/calendar-day-cell";
import type { CalendarDay } from "@/features/statistics/utils/month-activity";

const weekdays = ["Th 2", "Th 3", "Th 4", "Th 5", "Th 6", "Th 7", "CN"];

/**
 * Interactive calendar grid. Pointer capability drives the interaction model:
 * - Fine pointers (mouse/trackpad/keyboard) reveal details purely through CSS
 *   `group-hover` / `group-focus-within`; no click state is used.
 * - Coarse pointers (touch) open a single detail explicitly with component
 *   state via a tap; tapping another day switches, tapping outside or pressing
 *   Escape closes.
 */
export function ActivityCalendarGrid({
  days,
  today,
  timezone,
}: Readonly<{
  days: CalendarDay[];
  today: string;
  timezone: string;
}>) {
  const [openDate, setOpenDate] = useState<string | null>(null);
  const [isCoarse, setIsCoarse] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const match = window.matchMedia("(pointer: coarse)");
    const update = (): void => setIsCoarse(match.matches);
    update();
    match.addEventListener("change", update);
    return () => match.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!isCoarse) return;
    function handlePointerDown(event: PointerEvent): void {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpenDate(null);
    }
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") setOpenDate(null);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isCoarse]);

  return (
    <div ref={rootRef} className="mt-3 grid grid-cols-7 gap-1 text-center text-xs sm:gap-2">
      {weekdays.map((weekday) => (
        <span key={weekday} className="py-1 font-medium text-text-secondary">
          {weekday}
        </span>
      ))}
      {days.map((day, index) => {
        if (day.day === null) return <span key={`blank-${index}`} aria-hidden="true" />;
        return (
          <CalendarDayCell
            key={day.date}
            day={day}
            today={today}
            timezone={timezone}
            isCoarse={isCoarse}
            isOpen={openDate === day.date}
            onTap={() => {
              if (!isCoarse) return;
              setOpenDate((current) => (current === day.date ? null : day.date));
            }}
          />
        );
      })}
    </div>
  );
}
