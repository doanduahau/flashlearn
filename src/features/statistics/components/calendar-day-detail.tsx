"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";
import { monthDayLabel, type CalendarDay } from "@/features/statistics/utils/month-activity";

function dayAccuracy(detail: CalendarDay["detail"]): number | null {
  if (!detail || detail.questions === 0) return null;
  return Math.round((detail.correct / detail.questions) * 100);
}

const TOOLTIP_WIDTH = 208; // w-52 = 13rem = 208px
const TOOLTIP_GAP = 8; // gap between cell bottom and tooltip top

interface TooltipPosition {
  top: number;
  left: number;
}

function computePosition(anchorRect: DOMRect): TooltipPosition {
  // Default: below the cell, horizontally centred on the cell
  let top = anchorRect.bottom + TOOLTIP_GAP;
  let left = anchorRect.left + anchorRect.width / 2 - TOOLTIP_WIDTH / 2;

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Clamp horizontal: keep within viewport with 8px margin
  if (left + TOOLTIP_WIDTH > vw - 8) {
    left = vw - TOOLTIP_WIDTH - 8;
  }
  if (left < 8) {
    left = 8;
  }

  // Estimate tooltip height as ~88px (3 lines of content + padding).
  // If overflowing the bottom, flip to show above the cell.
  const estimatedHeight = 88;
  if (top + estimatedHeight > vh - 8) {
    top = anchorRect.top - estimatedHeight - TOOLTIP_GAP;
  }

  return { top, left };
}

/**
 * Portaled day-detail tooltip for desktop (fine pointer / keyboard).
 *
 * Rendered into document.body via createPortal, completely outside the
 * calendar grid's stacking context.  This ensures it always paints above
 * every grid sibling regardless of DOM order.
 *
 * pointer-events-none: the tooltip is purely informational and must not
 * interfere with hover events on underlying cells.
 */
export function CalendarDayDetail({
  day,
  timezone,
  anchorRect,
}: Readonly<{
  day: CalendarDay;
  timezone: string;
  anchorRect: DOMRect;
}>) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const accuracy = dayAccuracy(day.detail);

  // Position is purely derived from anchorRect — no state required.
  const position = useMemo(
    () => (mounted ? computePosition(anchorRect) : { top: 0, left: 0 }),
    [anchorRect, mounted],
  );

  if (!mounted || !day.detail) return null;

  return createPortal(
    <div
      role="tooltip"
      data-calendar-day-detail
      className={cn(
        "pointer-events-none fixed z-50 w-52 rounded-2xl border border-border-soft bg-surface p-3 text-left shadow-md",
        "animate-[fadeIn_120ms_ease-out]",
      )}
      style={{ top: position.top, left: position.left }}
    >
      <span className="block text-sm font-bold">{monthDayLabel(day.date, timezone)}</span>
      <span className="mt-1.5 block text-xs text-text-secondary">
        {day.detail.quizCount} bài kiểm tra · {day.detail.questions} câu
      </span>
      <span className="block text-xs text-text-secondary">
        {day.detail.correct} câu đúng · Độ chính xác {accuracy ?? 0}%
      </span>
    </div>,
    document.body,
  );
}
