import { Flame } from "lucide-react";

import { MascotImage } from "@/features/mascot/components/mascot-image";
import type { MascotLevel } from "@/features/mascot/types/mascot-types";
import { cn } from "@/lib/utils";

const MILESTONES: { level: MascotLevel; milestone: number | null }[] = [
  { level: 1, milestone: null },
  { level: 2, milestone: 30 },
  { level: 3, milestone: 60 },
  { level: 4, milestone: 120 },
  { level: 5, milestone: 240 },
];

export function MilestoneMascots({
  mascotLevel,
}: Readonly<{
  mascotLevel: MascotLevel;
}>) {
  return (
    <section
      aria-labelledby="streak-milestones-heading"
      className="mt-6 rounded-3xl border border-border-soft bg-surface p-5"
    >
      <h2 id="streak-milestones-heading" className="text-xl font-bold">
        Cột mốc streak
      </h2>
      <div className="mt-4 flex flex-wrap items-end justify-center gap-4 sm:gap-6">
        {MILESTONES.map((item) => {
          const isCurrent = item.level === mascotLevel;
          const statusText = isCurrent ? "đã đạt" : "chưa đạt";
          const ariaLabel = item.milestone
            ? `Cột mốc ${item.milestone} ngày streak — ${statusText}`
            : `Cột mốc Level 1 — ${statusText}`;

          return (
            <div
              key={item.level}
              aria-label={ariaLabel}
              className="flex flex-col items-center justify-end"
            >
              <div className="flex h-24 items-end justify-center">
                <MascotImage
                  level={item.level}
                  state="happy"
                  size={isCurrent ? 96 : 64}
                  className={cn(
                    "object-contain transition-all",
                    isCurrent ? "size-24" : "size-16 opacity-40 grayscale",
                  )}
                />
              </div>
              <div className="mt-1.5 flex items-center justify-center gap-0.5 text-xs font-semibold text-text-primary">
                {item.milestone ? (
                  <>
                    <span>{item.milestone}</span>
                    <Flame className="size-3.5 fill-warning text-warning" aria-hidden="true" />
                  </>
                ) : (
                  <span className="text-text-secondary">Level 1</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
