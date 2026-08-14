import { cn } from "@/lib/utils";

export type DashboardLearningStatusCounts = {
  dueCount: number;
  newCardsCount: number;
};

export function DashboardLearningStatus({
  dueCount,
  newCardsCount,
  className,
}: Readonly<DashboardLearningStatusCounts & { className?: string }>) {
  const items = [
    {
      label: "Cần ôn",
      count: dueCount,
      dotClassName: "bg-mastery-review-dot",
      labelClassName: "text-danger",
    },
    {
      label: "Chưa học",
      count: newCardsCount,
      dotClassName: "bg-mastery-untested-dot",
      labelClassName: "text-text-secondary",
    },
  ].filter((item) => item.count > 0);

  if (items.length === 0) return null;

  return (
    <div className={cn("flex flex-col justify-center gap-1.5 text-sm sm:text-base", className)}>
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-2">
          <span
            aria-hidden="true"
            className={cn("size-2 shrink-0 rounded-full", item.dotClassName)}
          />
          <span className={cn(item.labelClassName, "whitespace-nowrap")}>{item.label}</span>
          <span className="font-bold text-text-primary ml-1">{item.count}</span>
        </span>
      ))}
    </div>
  );
}
