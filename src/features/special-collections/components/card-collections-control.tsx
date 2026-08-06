"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { updateCardCollections } from "@/features/special-collections/server/actions";

export interface CardCollectionOption {
  id: string;
  name: string;
}

export function CardCollectionsControl({
  cardId,
  setId,
  collections,
  memberships,
}: Readonly<{
  cardId: string;
  setId: string;
  collections: CardCollectionOption[];
  memberships: string[];
}>) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(memberships));
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  if (collections.length === 0) {
    return (
      <Link href="/collections" className="text-sm font-medium text-primary-foreground underline">
        Tạo bộ đặc biệt
      </Link>
    );
  }

  function toggle(collectionId: string): void {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(collectionId)) {
        next.delete(collectionId);
      } else {
        next.add(collectionId);
      }
      return next;
    });
  }

  function save(): void {
    setError("");
    startTransition(async () => {
      const result = await updateCardCollections({
        cardId,
        setId,
        collectionIds: Array.from(selected),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setIsOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
      >
        Bộ đặc biệt ({memberships.length})
      </Button>
      {error ? (
        <p role="alert" className="text-danger">
          {error}
        </p>
      ) : null}
      {isOpen ? (
        <div className="rounded-2xl border border-border-soft bg-surface-subtle p-4">
          <p className="text-sm font-medium">Thêm vào bộ đặc biệt</p>
          <ul className="mt-2 space-y-2">
            {collections.map((collection) => (
              <li key={collection.id}>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selected.has(collection.id)}
                    onChange={() => toggle(collection.id)}
                  />
                  {collection.name}
                </label>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2">
            <Button type="button" disabled={isPending} onClick={save}>
              {isPending ? "Đang lưu…" : "Lưu"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={isPending}
              onClick={() => {
                setIsOpen(false);
                setSelected(new Set(memberships));
                setError("");
              }}
            >
              Hủy
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
