"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { getStudyCardCount } from "@/features/study/server/actions";
import { cn } from "@/lib/utils";

const COUNT_DEBOUNCE_MS = 250;

export interface StudySourceOption {
  id: string;
  name: string;
  cardCount: number;
}

interface SourceParams {
  setIds: string[];
  collectionIds: string[];
}

function sameSources(a: SourceParams, b: SourceParams): boolean {
  return (
    a.setIds.length === b.setIds.length &&
    a.collectionIds.length === b.collectionIds.length &&
    a.setIds.every((id, index) => id === b.setIds[index]) &&
    a.collectionIds.every((id, index) => id === b.collectionIds[index])
  );
}

export function StudySourceSelect({
  sets,
  collections,
  totalCards,
}: Readonly<{
  sets: StudySourceOption[];
  collections: StudySourceOption[];
  totalCards: number;
}>) {
  const router = useRouter();
  const [mode, setMode] = useState<"all" | "custom">("all");
  const [selectedSets, setSelectedSets] = useState<Set<string>>(() => new Set());
  const [selectedCollections, setSelectedCollections] = useState<Set<string>>(() => new Set());
  const [customCount, setCustomCount] = useState<{
    count: number;
    computedFor: SourceParams;
  } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, startTransition] = useTransition();

  useEffect(() => {
    if (mode !== "custom") return;
    const sources: SourceParams = {
      setIds: [...selectedSets],
      collectionIds: [...selectedCollections],
    };
    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        const result = await getStudyCardCount(sources);
        if (cancelled) return;
        if (result.ok) {
          setCustomCount({ count: result.count, computedFor: sources });
        } else {
          setActionError(result.error);
        }
      })();
    }, COUNT_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [mode, selectedSets, selectedCollections]);

  const currentSources: SourceParams = {
    setIds: [...selectedSets],
    collectionIds: [...selectedCollections],
  };
  const isCounting =
    mode === "custom" &&
    (customCount === null || !sameSources(customCount.computedFor, currentSources));
  const showCounting = isCounting && actionError === null;
  const canStart =
    mode === "all"
      ? totalCards >= 1
      : actionError === null && !isCounting && (customCount?.count ?? 0) >= 1;

  function toggleSet(id: string): void {
    setMode("custom");
    setActionError(null);
    setSelectedSets((previous) => {
      const next = new Set(previous);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleCollection(id: string): void {
    setMode("custom");
    setActionError(null);
    setSelectedCollections((previous) => {
      const next = new Set(previous);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function start(): void {
    setError(null);
    if (mode === "all") {
      if (totalCards < 1) {
        setError("Chưa có thẻ nào để học.");
        return;
      }
      router.push("/study/session?all=1");
      return;
    }
    startTransition(async () => {
      const result = await getStudyCardCount(currentSources);
      if (!result.ok) {
        setActionError(result.error);
        return;
      }
      if (result.count < 1) {
        setError("Chưa có thẻ nào trong phạm vi đã chọn.");
        return;
      }
      const query = new URLSearchParams();
      if (selectedSets.size) query.set("sets", [...selectedSets].join(","));
      if (selectedCollections.size) query.set("collections", [...selectedCollections].join(","));
      router.push(`/study/session?${query.toString()}`);
    });
  }

  if (sets.length === 0 && collections.length === 0) {
    return (
      <div className="mt-6 rounded-2xl border border-dashed border-border-soft bg-surface-subtle p-8 text-center">
        <p className="font-medium">Chưa có bộ flashcard.</p>
        <p className="mt-1 text-sm text-text-secondary">
          <Link className="underline" href="/import">
            Import tệp đầu tiên
          </Link>{" "}
          để bắt đầu học.
        </p>
      </div>
    );
  }

  const sourceOptionClass = (active: boolean) =>
    cn(
      "flex w-full items-center justify-between gap-3 rounded-2xl border p-4 text-left transition-colors",
      active
        ? "border-primary bg-primary-soft"
        : "border-border-soft bg-surface hover:bg-surface-subtle",
    );

  return (
    <div className="mt-6 space-y-6">
      <button
        type="button"
        aria-pressed={mode === "all"}
        onClick={() => {
          setMode("all");
          setError(null);
        }}
        className={sourceOptionClass(mode === "all")}
      >
        <span className="font-semibold">Tất cả thẻ</span>
        <span className="text-sm text-text-secondary">{totalCards} thẻ</span>
      </button>

      {sets.length ? (
        <section aria-label="Bộ flashcard">
          <h2 className="font-semibold">Bộ flashcard</h2>
          <ul className="mt-2 space-y-2">
            {sets.map((set) => (
              <li key={set.id}>
                <label className="flex items-center gap-3 rounded-2xl border border-border-soft bg-surface p-4">
                  <input
                    type="checkbox"
                    checked={selectedSets.has(set.id)}
                    onChange={() => toggleSet(set.id)}
                  />
                  <span className="min-w-0 flex-1 font-medium">{set.name}</span>
                  <span className="shrink-0 text-sm text-text-secondary">{set.cardCount} thẻ</span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {collections.length ? (
        <section aria-label="Bộ đặc biệt">
          <h2 className="font-semibold">Bộ đặc biệt</h2>
          <ul className="mt-2 space-y-2">
            {collections.map((collection) => (
              <li key={collection.id}>
                <label className="flex items-center gap-3 rounded-2xl border border-border-soft bg-surface p-4">
                  <input
                    type="checkbox"
                    checked={selectedCollections.has(collection.id)}
                    onChange={() => toggleCollection(collection.id)}
                  />
                  <span className="min-w-0 flex-1 font-medium">{collection.name}</span>
                  <span className="shrink-0 text-sm text-text-secondary">
                    {collection.cardCount} thẻ
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border-soft bg-surface p-4">
        <p className="font-medium">
          {mode === "all"
            ? `Tổng ${totalCards} thẻ duy nhất`
            : showCounting
              ? "Đang tính số thẻ…"
              : `Tổng ${customCount?.count ?? 0} thẻ duy nhất`}
        </p>
        <Button type="button" onClick={start} disabled={isStarting || !canStart}>
          {isStarting ? "Đang mở phiên…" : "Bắt đầu học"}
        </Button>
      </div>
      {actionError ? (
        <p role="alert" className="text-danger">
          {actionError}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
