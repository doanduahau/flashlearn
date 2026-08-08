"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { SourceBrowser } from "@/features/source-selection/components/source-browser";
import type { SourceOption, SourcePage } from "@/features/source-selection/types/source-types";
import { getStudyCardCount } from "@/features/study/server/actions";
import { cn } from "@/lib/utils";

const COUNT_DEBOUNCE_MS = 250;

type SourceParams = {
  setIds: string[];
  collectionIds: string[];
};

function sameSources(a: SourceParams, b: SourceParams): boolean {
  return (
    a.setIds.length === b.setIds.length &&
    a.collectionIds.length === b.collectionIds.length &&
    a.setIds.every((id, index) => id === b.setIds[index]) &&
    a.collectionIds.every((id, index) => id === b.collectionIds[index])
  );
}

export function StudySourceSelect({
  sourcePage,
  sets,
  collections,
  totalCards,
}: Readonly<{
  sourcePage?: SourcePage;
  sets?: { id: string; name: string; cardCount: number }[];
  collections?: { id: string; name: string; cardCount: number }[];
  totalCards: number;
}>) {
  const router = useRouter();
  const [mode, setMode] = useState<"all" | "custom">("all");
  const [selected, setSelected] = useState<Map<string, SourceOption>>(() => new Map());
  const [customCount, setCustomCount] = useState<{
    count: number;
    computedFor: SourceParams;
  } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, startTransition] = useTransition();
  const resolvedSourcePage: SourcePage = sourcePage ?? {
    sources: [
      ...(sets ?? []).map((source) => ({ ...source, kind: "regular" as const })),
      ...(collections ?? []).map((source) => ({ ...source, kind: "special" as const })),
    ],
    page: 1,
    totalPages: 1,
    query: "",
    type: "all",
  };

  const selectedSources = useMemo(() => [...selected.values()], [selected]);
  const currentSources = useMemo<SourceParams>(
    () => ({
      setIds: selectedSources
        .filter((source) => source.kind === "regular")
        .map((source) => source.id),
      collectionIds: selectedSources
        .filter((source) => source.kind === "special")
        .map((source) => source.id),
    }),
    [selectedSources],
  );

  useEffect(() => {
    if (mode !== "custom") return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        const result = await getStudyCardCount(currentSources);
        if (cancelled) return;
        if (result.ok) setCustomCount({ count: result.count, computedFor: currentSources });
        else setActionError(result.error);
      })();
    }, COUNT_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [currentSources, mode]);

  const isCounting =
    mode === "custom" &&
    (customCount === null || !sameSources(customCount.computedFor, currentSources));
  const availableCards = mode === "all" ? totalCards : (customCount?.count ?? 0);
  const canStart =
    mode === "all" ? totalCards > 0 : actionError === null && !isCounting && availableCards > 0;

  function toggleSource(source: SourceOption): void {
    setMode("custom");
    setActionError(null);
    setError(null);
    setSelected((previous) => {
      const next = new Map(previous);
      const key = `${source.kind}:${source.id}`;
      if (next.has(key)) next.delete(key);
      else next.set(key, source);
      return next;
    });
  }

  function start(): void {
    setError(null);
    if (mode === "all") {
      if (!totalCards) {
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
      if (!result.count) {
        setError("Chưa có thẻ nào trong phạm vi đã chọn.");
        return;
      }
      const query = new URLSearchParams();
      if (currentSources.setIds.length) query.set("sets", currentSources.setIds.join(","));
      if (currentSources.collectionIds.length)
        query.set("collections", currentSources.collectionIds.join(","));
      router.push(`/study/session?${query.toString()}`);
    });
  }

  return (
    <div className="mt-3 space-y-3 pb-28 sm:mt-5 sm:space-y-5 md:pb-0">
      {!totalCards ? (
        <div className="rounded-2xl border border-dashed border-border-soft bg-surface-subtle p-5 text-center">
          <p className="font-medium">Chưa có thẻ flashcard để học.</p>
          <Link className="mt-2 inline-block underline" href="/sets?create=import">
            Nhập tệp đầu tiên
          </Link>
        </div>
      ) : null}
      <button
        type="button"
        aria-pressed={mode === "all"}
        onClick={() => {
          setMode("all");
          setError(null);
        }}
        className={cn(
          "flex w-full items-center justify-between gap-3 rounded-2xl border p-2.5 text-left text-sm transition-colors sm:p-4",
          mode === "all"
            ? "border-primary bg-primary-soft"
            : "border-border-soft bg-surface hover:bg-surface-subtle",
        )}
      >
        <span className="font-semibold">Tất cả thẻ</span>
        <span className="shrink-0 text-text-secondary">{totalCards} thẻ</span>
      </button>
      <SourceBrowser
        path="/study"
        sourcePage={resolvedSourcePage}
        selected={selectedSources}
        onToggle={toggleSource}
      />
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
      <StudyActionBar
        selectedCount={mode === "all" ? 0 : selectedSources.length}
        availableCards={availableCards}
        counting={isCounting}
        pending={isStarting}
        canStart={canStart}
        onStart={start}
      />
    </div>
  );
}

function StudyActionBar({
  selectedCount,
  availableCards,
  counting,
  pending,
  canStart,
  onStart,
}: Readonly<{
  selectedCount: number;
  availableCards: number;
  counting: boolean;
  pending: boolean;
  canStart: boolean;
  onStart: () => void;
}>) {
  return (
    <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-y border-border-soft bg-surface/95 p-3 shadow-[0_-8px_24px_rgba(39,93,70,0.08)] backdrop-blur md:sticky md:bottom-4 md:rounded-2xl md:border">
      <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-3 md:max-w-none">
        <p aria-live="polite" className="min-w-0 text-sm font-medium">
          {counting ? "Đang tính thẻ…" : `${selectedCount} nguồn · ${availableCards} thẻ`}
        </p>
        <Button
          type="button"
          className="min-h-11 shrink-0"
          onClick={onStart}
          disabled={pending || !canStart}
        >
          {pending ? "Đang mở phiên…" : "Bắt đầu học"}
        </Button>
      </div>
    </div>
  );
}
