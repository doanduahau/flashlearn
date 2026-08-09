import { getMasteryPresentation } from "@/features/mastery/presentation/mastery-presentation";
import type { MasteryStatus } from "@/features/mastery/types/mastery-types";
import { cn } from "@/lib/utils";

export function MasteryIndicator({ status }: Readonly<{ status: MasteryStatus }>) {
  const presentation = getMasteryPresentation(status);
  return (
    <span
      role="img"
      aria-label={presentation.label}
      title={presentation.label}
      className="inline-flex items-center"
    >
      <span
        aria-hidden="true"
        className={cn("size-2 rounded-full", presentation.indicatorClassName)}
      />
    </span>
  );
}
