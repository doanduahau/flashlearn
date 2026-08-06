import Link from "next/link";

export interface CollectionSummary {
  id: string;
  name: string;
  cardCount: number;
}

export function CollectionsList({
  collections,
  hasSearch,
}: Readonly<{ collections: CollectionSummary[]; hasSearch: boolean }>) {
  if (!collections.length) {
    return (
      <p className="mt-5 text-text-secondary">
        {hasSearch
          ? "Không tìm thấy bộ đặc biệt phù hợp."
          : "Chưa có bộ đặc biệt nào. Tạo bộ đầu tiên để gom thẻ từ nhiều bộ flashcard."}
      </p>
    );
  }

  return (
    <ul className="mt-5 grid gap-3">
      {collections.map((collection) => (
        <li key={collection.id}>
          <Link
            className="flex items-center justify-between gap-3 rounded-2xl border border-border-soft bg-surface p-5 hover:bg-surface-subtle"
            href={`/collections/${collection.id}`}
          >
            <span className="font-semibold">{collection.name}</span>
            <span className="shrink-0 text-sm text-text-secondary">{collection.cardCount} thẻ</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
