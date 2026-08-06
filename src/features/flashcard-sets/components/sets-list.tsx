import Link from "next/link";

export interface SetSummary {
  id: string;
  name: string;
  cardCount: number;
}

export function SetsList({
  sets,
  hasSearch,
}: Readonly<{ sets: SetSummary[]; hasSearch: boolean }>) {
  if (!sets.length) {
    return (
      <p className="mt-5 text-text-secondary">
        {hasSearch ? "Không tìm thấy bộ phù hợp." : "Chưa có bộ flashcard nào."}
      </p>
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
