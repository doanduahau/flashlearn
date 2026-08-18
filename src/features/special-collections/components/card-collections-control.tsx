"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FolderPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { LoadingDots } from "@/components/shared/loading-dots";
import { updateCardCollections } from "@/features/special-collections/server/actions";
import { cn } from "@/lib/utils";

export interface CardCollectionOption {
  id: string;
  name: string;
}

export function CardCollectionsControl({
  cardId,
  setId,
  collections,
  memberships,
  variant = "text",
  label,
}: Readonly<{
  cardId: string;
  setId: string;
  collections: CardCollectionOption[];
  memberships: string[];
  variant?: "text" | "icon";
  label?: string;
}>) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const hasOpened = useRef(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(memberships));
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (hasOpened.current && !isOpen && !isPending) {
      triggerRef.current?.focus();
    }
  }, [isOpen, isPending]);

  useEffect(() => {
    if (!isOpen) return;

    function onPointerDown(event: PointerEvent): void {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        closePanel();
      }
    }

    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        event.preventDefault();
        closePanel();
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  if (collections.length === 0) {
    return (
      <Link href="/collections" className="text-sm font-medium text-primary-foreground underline">
        Tạo bộ đặc biệt
      </Link>
    );
  }

  const isIcon = variant === "icon";

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

  function closePanel(): void {
    setIsOpen(false);
    setError("");
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
      closePanel();
      router.refresh();
    });
  }

  return (
    <div
      ref={containerRef}
      className={isIcon ? "relative" : "space-y-2"}
      onClick={(event) => event.stopPropagation()}
    >
      <Button
        ref={triggerRef}
        type="button"
        variant={isIcon ? "ghost" : "outline"}
        size={isIcon ? "icon" : "default"}
        className={isIcon ? "shrink-0" : undefined}
        onClick={() => {
          if (!isOpen) hasOpened.current = true;
          setIsOpen((open) => !open);
        }}
        aria-expanded={isOpen}
        aria-label={isIcon ? "Thêm vào bộ đặc biệt" : undefined}
        title={isIcon ? "Thêm vào bộ đặc biệt" : undefined}
        disabled={isPending}
      >
        {isIcon ? (
          <FolderPlus aria-hidden="true" />
        ) : (
          (label ?? `Bộ đặc biệt (${memberships.length})`)
        )}
      </Button>
      {error && !isIcon ? (
        <p role="alert" className="text-danger">
          {error}
        </p>
      ) : null}
      {isOpen ? (
        <div
          data-testid="card-collections-panel"
          className={cn(
            "rounded-2xl border border-border-soft p-4",
            isIcon
              ? "absolute right-0 top-12 z-20 max-h-[min(28rem,calc(100dvh-10rem))] max-w-[calc(100vw-2rem)] w-72 overflow-y-auto bg-surface shadow-soft-card"
              : "bg-surface-subtle",
          )}
        >
          <p className="text-sm font-medium">Thêm vào bộ đặc biệt</p>
          {error && isIcon ? (
            <p role="alert" className="mt-2 text-danger">
              {error}
            </p>
          ) : null}
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
              {isPending ? <LoadingDots label="Đang lưu" /> : "Lưu"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={isPending}
              onClick={() => {
                closePanel();
                setSelected(new Set(memberships));
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
