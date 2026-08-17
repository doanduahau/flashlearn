"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { StickyStartBar } from "@/features/learning-modes/components/sticky-start-bar";
import type { MascotLevel } from "@/features/mascot/types/mascot-types";
import { SourceBrowser } from "@/features/source-selection/components/source-browser";
import type { SourceOption, SourcePage } from "@/features/source-selection/types/source-types";

export function QuizSetup({
  sourcePage,
  totalCards,
  mascotLevel,
}: Readonly<{
  sourcePage: SourcePage;
  totalCards: number;
  mascotLevel: MascotLevel;
}>) {
  const router = useRouter();
  const [all, setAll] = useState(true);
  const [selected, setSelected] = useState<Map<string, SourceOption>>(() => new Map());
  const [error, setError] = useState<string | null>(null);
  const [, transition] = useTransition();

  const selectedSources = useMemo(() => [...selected.values()], [selected]);
  const currentSources = useMemo(
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

  // Show totalCards immediately (like the study page) — no need to call the
  // eligibility RPC here. Dedup and per-mode filtering happen server-side on
  // /quiz/mode after the user presses "Bắt đầu kiểm tra".
  const total = all ? totalCards : selectedSources.reduce((sum, s) => sum + (s.cardCount ?? 0), 0);
  const canStart =
    total >= 1 && (all || currentSources.setIds.length + currentSources.collectionIds.length > 0);

  function toggleSource(source: SourceOption): void {
    setAll(false);
    setError(null);
    setSelected((previous) => {
      const next = new Map(
        [...previous.entries()].filter(([, selectedSource]) => selectedSource.kind === source.kind),
      );
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

  function goToMode(): void {
    transition(() => {
      setError(null);
      const q = new URLSearchParams();
      if (all) {
        q.set("all", "1");
      } else {
        if (currentSources.setIds.length) q.set("sets", currentSources.setIds.join(","));
        if (currentSources.collectionIds.length)
          q.set("collections", currentSources.collectionIds.join(","));
      }
      router.push(`/quiz/mode?${q.toString()}`);
    });
  }

  return (
    <div className="mt-2 space-y-3 pb-28 sm:mt-5 sm:space-y-4 md:pb-0">
      <SourceBrowser
        path="/quiz"
        sourcePage={sourcePage}
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
        summary={`${total} thẻ`}
        canStart={canStart}
        pending={false}
        pendingLabel="Đang tải…"
        startLabel="Bắt đầu kiểm tra"
        onStart={goToMode}
      />
    </div>
  );
}
