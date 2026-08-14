"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { StickyStartBar } from "@/features/learning-modes/components/sticky-start-bar";
import { MascotImage } from "@/features/mascot/components/mascot-image";
import { SourceBrowser } from "@/features/source-selection/components/source-browser";
import type { SourceOption, SourcePage } from "@/features/source-selection/types/source-types";
import { getStudyCardCount } from "@/features/study/server/actions";

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
  const [all, setAll] = useState(true);
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
    if (all) return;
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
  }, [currentSources, all]);

  const isCounting =
    !all && (customCount === null || !sameSources(customCount.computedFor, currentSources));
  const availableCards = all ? totalCards : (customCount?.count ?? 0);
  const canStart = all ? totalCards > 0 : actionError === null && !isCounting && availableCards > 0;

  function toggleSource(source: SourceOption): void {
    setAll(false);
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

  function selectAll(): void {
    setAll(true);
    setSelected(new Map());
    setError(null);
  }

  function start(): void {
    setError(null);
    if (all) {
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
          <MascotImage
            level={1}
            state="thinking"
            size={48}
            className="mx-auto size-12 object-contain"
          />
          <p className="font-medium">Chưa có thẻ flashcard để học.</p>
          <Link className="mt-2 inline-block underline" href="/sets?create=import">
            Nhập tệp đầu tiên
          </Link>
        </div>
      ) : null}
      <SourceBrowser
        path="/study"
        sourcePage={resolvedSourcePage}
        selected={selectedSources}
        onToggle={toggleSource}
        allCount={totalCards}
        allSelected={all}
        onSelectAll={selectAll}
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
      <StickyStartBar
        summary={
          isCounting
            ? "Đang tính thẻ…"
            : all
              ? `${availableCards} thẻ`
              : `${selectedSources.length} nguồn · ${availableCards} thẻ`
        }
        canStart={canStart}
        pending={isStarting}
        pendingLabel="Đang mở phiên…"
        startLabel="Bắt đầu học"
        onStart={start}
      />
    </div>
  );
}
