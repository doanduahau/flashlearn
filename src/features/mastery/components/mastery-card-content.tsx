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
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium text-text-secondary">{badge}</p>
        <MasteryIndicator status={status} />
      </div>
      <p className="mt-1 whitespace-pre-wrap break-words font-semibold">{front}</p>
      <p className="mt-2 whitespace-pre-wrap break-words text-text-secondary">{back}</p>
    </div>
  );
}
