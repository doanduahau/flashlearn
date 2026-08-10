import type { MasteryAggregate } from "@/features/mastery/utils/aggregate-mastery";
import { cn } from "@/lib/utils";

/**
 * Dashboard displays two separate domains: FSRS decides what is actionable
 * now; Mastery retains its independent confidence aggregate.
 */
export function DashboardLearningStatus({
  masteryAggregate,
  smartReviewActionableCount,
  className,
}: Readonly<{
  masteryAggregate: MasteryAggregate;
  smartReviewActionableCount: number;
  className?: string;
}>) {
  const items = [
    {
      label: "Cần ôn",
      count: smartReviewActionableCount,
      dotClassName: "bg-mastery-review-dot",
      labelClassName: "text-danger",
    },
    {
      label: "Chưa học",
      count: masteryAggregate.untested,
      dotClassName: "bg-mastery-untested-dot",
      labelClassName: "text-text-secondary",
    },
  ].filter((item) => item.count > 0);

  if (items.length === 0) return null;

  return (
    <p className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 text-sm", className)}>
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className={cn("size-2 rounded-full", item.dotClassName)} />
          <span className={item.labelClassName}>{item.label}</span>
          <span className="font-semibold text-text-primary">{item.count}</span>
        </span>
      ))}
    </p>
  );
}
