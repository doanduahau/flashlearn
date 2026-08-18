"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { StickyStartBar } from "@/features/learning-modes/components/sticky-start-bar";
import { MascotImage } from "@/features/mascot/components/mascot-image";
import type { MascotLevel } from "@/features/mascot/types/mascot-types";
import { SourceBrowser } from "@/features/source-selection/components/source-browser";
import type { SourceOption, SourcePage } from "@/features/source-selection/types/source-types";

type SourceParams = {
  setIds: string[];
  collectionIds: string[];
};

type InitialSource = SourceParams & { all: boolean };

export function StudySourceSelect({
  sourcePage,
  sets,
  collections,
  totalCards,
  initialSource,
  mascotLevel,
}: Readonly<{
  sourcePage?: SourcePage;
  sets?: { id: string; name: string; cardCount: number }[];
  collections?: { id: string; name: string; cardCount: number }[];
  totalCards: number;
  initialSource?: InitialSource;
  mascotLevel: MascotLevel;
}>) {
  const router = useRouter();
  const [all, setAll] = useState(initialSource?.all ?? true);
  const [error, setError] = useState<string | null>(null);
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
  const [selected, setSelected] = useState<Map<string, SourceOption>>(() => {
    if (!initialSource || initialSource.all) return new Map();
    const selectedIds = new Set([...initialSource.setIds, ...initialSource.collectionIds]);
    return new Map(
      resolvedSourcePage.sources
        .filter((source) => selectedIds.has(source.id))
        .map((source) => [`${source.kind}:${source.id}`, source]),
    );
  });

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

  // Show the card count immediately like /quiz: totalCards for "Tất cả",
  // otherwise the sum of each selected source's cardCount (before dedup).
  // Dedup still happens server-side on /study/mode after the user presses
  // "Bắt đầu học".
  const total = all
    ? totalCards
    : selectedSources.reduce((sum, source) => sum + (source.cardCount ?? 0), 0);
  const canStart = total >= 1 && (all || selectedSources.length > 0);

  function toggleSource(source: SourceOption): void {
    setAll(false);
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
      router.push("/study/mode?all=1");
      return;
    }
    const query = new URLSearchParams();
    if (currentSources.setIds.length) query.set("sets", currentSources.setIds.join(","));
    if (currentSources.collectionIds.length)
      query.set("collections", currentSources.collectionIds.join(","));
    router.push(`/study/mode?${query.toString()}`);
  }

  return (
    <div className="mt-3 space-y-3 pb-28 sm:mt-5 sm:space-y-5 md:pb-0">
      {!totalCards ? (
        <div className="rounded-2xl border border-dashed border-border-soft bg-surface-subtle p-5 text-center">
          <MascotImage
            level={mascotLevel}
            state="thinking"
            size={64}
            className="mx-auto size-16 object-contain"
          />
          <p className="font-medium">Chưa có thẻ flashcard để học.</p>
          <Link className="mt-2 inline-block underline" href="/sets/create?source=file">
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
        mascotLevel={mascotLevel}
      />
      {error ? (
        <p role="alert" className="text-danger">
          {error}
        </p>
      ) : null}
      <StickyStartBar
        summary={all ? `${total} thẻ` : `${selectedSources.length} nguồn · ${total} thẻ`}
        canStart={canStart}
        pending={false}
        pendingLabel="Đang tải…"
        startLabel="Bắt đầu học"
        onStart={start}
      />
    </div>
  );
}
