import { MasteryIndicator } from "@/features/mastery/components/mastery-indicator";
import type { MasteryStatus } from "@/features/mastery/types/mastery-types";

export function MasteryCardContent({
  status,
  badge,
  front,
  back,
}: Readonly<{
  status: MasteryStatus;
  badge: string;
  front: string;
  back: string;
}>) {
  return (
    <div className="min-w-0 max-w-full flex-1">
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium text-text-secondary">{badge}</p>
        <MasteryIndicator status={status} />
      </div>
      <p className="mt-1 max-w-full whitespace-pre-wrap break-words font-semibold [overflow-wrap:anywhere]">
        {front}
      </p>
      <p className="mt-2 max-w-full whitespace-pre-wrap break-words text-text-secondary [overflow-wrap:anywhere]">
        {back}
      </p>
    </div>
  );
}
