import { Flame } from "lucide-react";

import { cn } from "@/lib/utils";

export function StreakSummary({
  streak,
  completedToday,
  compact = false,
}: Readonly<{ streak: number; completedToday: boolean; compact?: boolean }>) {
  const status = completedToday ? "hôm nay đã hoàn thành" : "hôm nay chưa hoàn thành";

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl border border-border-soft bg-surface p-4",
        compact && "p-3",
      )}
      aria-label={`Chuỗi ${streak} ngày, ${status}`}
    >
      <span
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-2xl",
          completedToday
            ? "bg-warning/20 text-warning motion-safe:animate-[pulse_2.5s_ease-in-out_infinite]"
            : "bg-surface-subtle text-text-secondary",
        )}
      >
        <Flame
          className="size-6"
          fill={completedToday ? "currentColor" : "none"}
          aria-hidden="true"
        />
      </span>
      <div>
        <p className="text-sm text-text-secondary">Chuỗi học</p>
        <p className="text-2xl font-bold">
          {streak} <span className="text-base font-semibold">ngày</span>
        </p>
        <p className="text-xs text-text-secondary">
          {completedToday ? "Hôm nay đã hoàn thành" : "Hôm nay chưa hoàn thành"}
        </p>
      </div>
    </div>
  );
}
