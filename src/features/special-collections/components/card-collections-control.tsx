"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FolderPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
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
}: Readonly<{
  cardId: string;
  setId: string;
  collections: CardCollectionOption[];
  memberships: string[];
  variant?: "text" | "icon" | "responsive";
}>) {
  const router = useRouter();
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

  if (collections.length === 0) {
    return (
      <Link href="/collections" className="text-sm font-medium text-primary-foreground underline">
        Tạo bộ đặc biệt
      </Link>
    );
  }

  const isIcon = variant === "icon";
  const isResponsive = variant === "responsive";

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
      className={isIcon || isResponsive ? "relative" : "space-y-2"}
      onClick={isIcon || isResponsive ? (event) => event.stopPropagation() : undefined}
    >
      <Button
        ref={triggerRef}
        type="button"
        variant="outline"
        size={isIcon || isResponsive ? "icon" : "default"}
        className={isResponsive ? "size-11 sm:h-10 sm:w-auto sm:px-4" : undefined}
        onClick={() => {
          if (!isOpen) hasOpened.current = true;
          setIsOpen((open) => !open);
        }}
        aria-expanded={isOpen}
        aria-label={
          isIcon
            ? "Thêm vào bộ đặc biệt"
            : isResponsive
              ? `Bộ đặc biệt (${memberships.length})`
              : undefined
        }
        title={isIcon || isResponsive ? "Thêm vào bộ đặc biệt" : undefined}
        disabled={isPending}
      >
        {isIcon ? (
          <FolderPlus aria-hidden="true" />
        ) : isResponsive ? (
          <>
            <FolderPlus aria-hidden="true" />
            <span className="hidden sm:inline">Bộ đặc biệt ({memberships.length})</span>
          </>
        ) : (
          `Bộ đặc biệt (${memberships.length})`
        )}
      </Button>
      {error && !isIcon && !isResponsive ? (
        <p role="alert" className="text-danger">
          {error}
        </p>
      ) : null}
      {isOpen ? (
        <div
          className={cn(
            "rounded-2xl border border-border-soft p-4",
            isIcon || isResponsive
              ? "absolute right-0 top-12 z-20 w-72 bg-surface shadow-[0_8px_24px_rgba(39,93,70,0.08)]"
              : "bg-surface-subtle",
          )}
        >
          <p className="text-sm font-medium">Thêm vào bộ đặc biệt</p>
          {error && (isIcon || isResponsive) ? (
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
              {isPending ? "Đang lưu…" : "Lưu"}
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
