import Link from "next/link";

import { MascotImage } from "@/features/mascot/components/mascot-image";
import type { MascotLevel } from "@/features/mascot/types/mascot-types";

export interface SetSummary {
  id: string;
  name: string;
  cardCount: number;
}

export function SetsList({
  sets,
  hasSearch,
  mascotLevel,
}: Readonly<{ sets: SetSummary[]; hasSearch: boolean; mascotLevel: MascotLevel }>) {
  if (!sets.length) {
    return (
      <div className="mt-5 flex flex-col items-start gap-2 text-text-secondary">
        <MascotImage
          level={mascotLevel}
          state="thinking"
          size={48}
          className="size-12 object-contain"
        />
        <p>{hasSearch ? "Không tìm thấy bộ phù hợp." : "Chưa có bộ flashcard nào."}</p>
      </div>
    );
  }

  return (
    <ul className="mt-5 grid gap-3">
      {sets.map((set) => (
        <li key={set.id}>
          <Link
            className="flex items-center justify-between gap-3 rounded-2xl border border-border-soft bg-surface p-5 hover:bg-surface-subtle"
            href={`/sets/${set.id}`}
          >
            <span className="font-semibold">{set.name}</span>
            <span className="shrink-0 text-sm text-text-secondary">{set.cardCount} flashcard</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
