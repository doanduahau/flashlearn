"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface SetSummary {
  id: string;
  name: string;
  cardCount: number;
}

export function SetsList({ sets }: Readonly<{ sets: SetSummary[] }>) {
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLocaleLowerCase();
  const filtered = useMemo(() => {
    if (!normalized) return sets;
    return sets.filter((set) => set.name.toLocaleLowerCase().includes(normalized));
  }, [sets, normalized]);

  return (
    <section className="mt-6 space-y-4">
      <div className="max-w-sm">
        <Label htmlFor="sets-search">Tìm bộ</Label>
        <Input
          id="sets-search"
          className="mt-1"
          value={query}
          placeholder="Tên bộ flashcard"
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      {filtered.length ? (
        <ul className="grid gap-3">
          {filtered.map((set) => (
            <li key={set.id}>
              <Link
                className="flex items-center justify-between gap-3 rounded-2xl border border-border-soft bg-surface p-5 hover:bg-surface-subtle"
                href={`/sets/${set.id}`}
              >
                <span className="font-semibold">{set.name}</span>
                <span className="shrink-0 text-sm text-text-secondary">
                  {set.cardCount} flashcard
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : sets.length ? (
        <p className="text-text-secondary">Không tìm thấy bộ phù hợp.</p>
      ) : (
        <p className="text-text-secondary">
          Chưa có bộ flashcard.{" "}
          <Link className="underline" href="/import">
            Import tệp đầu tiên
          </Link>
          .
        </p>
      )}
    </section>
  );
}
