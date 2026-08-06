"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface CollectionSummary {
  id: string;
  name: string;
  cardCount: number;
}

export function CollectionsList({ collections }: Readonly<{ collections: CollectionSummary[] }>) {
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLocaleLowerCase();
  const filtered = useMemo(() => {
    if (!normalized) return collections;
    return collections.filter((collection) =>
      collection.name.toLocaleLowerCase().includes(normalized),
    );
  }, [collections, normalized]);

  return (
    <section className="mt-6 space-y-4">
      <div className="max-w-sm">
        <Label htmlFor="collections-search">Tìm bộ đặc biệt</Label>
        <Input
          id="collections-search"
          className="mt-1"
          value={query}
          placeholder="Tên bộ đặc biệt"
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      {filtered.length ? (
        <ul className="grid gap-3">
          {filtered.map((collection) => (
            <li key={collection.id}>
              <Link
                className="flex items-center justify-between gap-3 rounded-2xl border border-border-soft bg-surface p-5 hover:bg-surface-subtle"
                href={`/collections/${collection.id}`}
              >
                <span className="font-semibold">{collection.name}</span>
                <span className="shrink-0 text-sm text-text-secondary">
                  {collection.cardCount} thẻ
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : collections.length ? (
        <p className="text-text-secondary">Không tìm thấy bộ đặc biệt phù hợp.</p>
      ) : (
        <p className="text-text-secondary">
          Chưa có bộ đặc biệt nào. Tạo bộ đầu tiên để gom thẻ từ nhiều bộ flashcard.
        </p>
      )}
    </section>
  );
}
