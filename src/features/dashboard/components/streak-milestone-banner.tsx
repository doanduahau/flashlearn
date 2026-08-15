import { MascotImage } from "@/features/mascot/components/mascot-image";
import { STREAK_LEVEL_THRESHOLDS } from "@/features/mascot/types/mascot-types";
import { levelFromStreak } from "@/features/mascot/utils/mascot-level";

const MILESTONES = STREAK_LEVEL_THRESHOLDS.slice(1);

export function StreakMilestoneBanner({ streak }: Readonly<{ streak: number }>) {
  if (!MILESTONES.includes(streak as (typeof MILESTONES)[number])) return null;

  const nextMilestone = MILESTONES.find((milestone) => milestone > streak);

  return (
    <section
      aria-label="Cột mốc chuỗi học tập"
      className="mt-2 flex items-center gap-3 rounded-2xl border border-primary bg-primary-soft px-3 py-2.5 sm:mt-3 sm:rounded-3xl sm:px-5 sm:py-3"
    >
      <MascotImage
        level={levelFromStreak(streak)}
        state="congrats"
        size={64}
        className="size-16 shrink-0 object-contain"
      />
      <div>
        <h2 className="font-semibold">Chúc mừng! Bạn đã đạt chuỗi {streak} ngày</h2>
        {nextMilestone ? (
          <p className="mt-0.5 text-sm text-text-secondary">Mốc tiếp theo: {nextMilestone} ngày.</p>
        ) : null}
      </div>
    </section>
  );
}
