import { Flame } from "lucide-react";

import { cn } from "@/lib/utils";
import { streakLabel } from "@/features/statistics/utils/streak-label";

export function StreakIndicator({
  streak,
  completedToday,
  className,
}: Readonly<{ streak: number; completedToday: boolean; className?: string }>) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm font-bold",
        completedToday
          ? "border-warning/40 bg-warning/10 text-primary-foreground"
          : "border-border-soft bg-surface-subtle text-text-secondary",
        className,
      )}
      aria-label={streakLabel(streak, completedToday)}
      title={streakLabel(streak, completedToday)}
    >
      <Flame
        className={cn("size-4", completedToday ? "text-warning" : "text-text-secondary")}
        fill={completedToday ? "currentColor" : "none"}
        aria-hidden="true"
      />
      <span>{streak}</span>
    </span>
  );
}
