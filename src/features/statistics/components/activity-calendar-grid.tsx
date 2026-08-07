"use client";

import { useEffect, useRef, useState } from "react";

import { CalendarDayCell } from "@/features/statistics/components/calendar-day-cell";
import { CalendarDayDetail } from "@/features/statistics/components/calendar-day-detail";
import type { CalendarDay } from "@/features/statistics/utils/month-activity";

const weekdays = ["Th 2", "Th 3", "Th 4", "Th 5", "Th 6", "Th 7", "CN"];

/**
 * Interactive calendar grid. Pointer capability drives the interaction model:
 *
 * Fine pointers (mouse/trackpad/keyboard):
 *   - mouseenter on a cell -> portaled CalendarDayDetail rendered to document.body
 *   - mouseleave from the cell -> portal unmounted immediately
 *   - focusin on a cell -> same portal shown
 *   - focusout from the cell -> portal unmounted
 *   - No click-open state is maintained on desktop.
 *   - The portal is outside the grid stacking context, so it always renders
 *     above every grid cell regardless of DOM order.
 *
 * Coarse pointers (touch):
 *   - Tap opens a single detail inline within the cell (existing behaviour).
 *   - Tapping another day switches detail.
 *   - Tapping outside or pressing Escape closes.
 *   - Mobile tap behaviour is unchanged from before.
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
  // ── Mobile tap state ─────────────────────────────────────────────────────
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

  // ── Desktop portal state ─────────────────────────────────────────────────
  const [desktopDay, setDesktopDay] = useState<CalendarDay | null>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  function openDesktop(day: CalendarDay, rect: DOMRect): void {
    setDesktopDay(day);
    setAnchorRect(rect);
  }

  function closeDesktop(): void {
    setDesktopDay(null);
    setAnchorRect(null);
  }

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
            onDesktopMouseEnter={(event) => {
              if (!day.detail) return;
              openDesktop(day, event.currentTarget.getBoundingClientRect());
            }}
            onDesktopMouseLeave={closeDesktop}
            onDesktopFocus={(event) => {
              if (!day.detail) return;
              openDesktop(day, event.currentTarget.getBoundingClientRect());
            }}
            onDesktopBlur={closeDesktop}
          />
        );
      })}

      {/* Desktop portaled detail — rendered outside the grid stacking context */}
      {!isCoarse && desktopDay?.detail && anchorRect ? (
        <CalendarDayDetail day={desktopDay} timezone={timezone} anchorRect={anchorRect} />
      ) : null}
    </div>
  );
}
