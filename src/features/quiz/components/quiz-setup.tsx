"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { StickyStartBar } from "@/features/learning-modes/components/sticky-start-bar";
import type { MascotLevel } from "@/features/mascot/types/mascot-types";
import { SourceBrowser } from "@/features/source-selection/components/source-browser";
import type { SourceOption, SourcePage } from "@/features/source-selection/types/source-types";
import { getQuizEligibility } from "@/features/quiz/server/actions";

const COUNT_DEBOUNCE_MS = 250;

type SourceParams = { setIds: string[]; collectionIds: string[] };

function sameSources(a: SourceParams, b: SourceParams): boolean {
  return (
    a.setIds.length === b.setIds.length &&
    a.collectionIds.length === b.collectionIds.length &&
    a.setIds.every((id, index) => id === b.setIds[index]) &&
    a.collectionIds.every((id, index) => id === b.collectionIds[index])
  );
}

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
  const [eligibility, setEligibility] = useState<{
    total: number;
    computedFor: SourceParams;
    all: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, transition] = useTransition();

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
    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        const result = await getQuizEligibility({
          all,
          setIds: currentSources.setIds,
          collectionIds: currentSources.collectionIds,
        });
        if (cancelled) return;
        if (result.ok) {
          setEligibility({ total: result.total, computedFor: currentSources, all });
        }
      })();
    }, COUNT_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [all, currentSources]);

  const counting =
    eligibility === null ||
    eligibility.all !== all ||
    !sameSources(eligibility.computedFor, currentSources);
  const total = eligibility?.total ?? 0;

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

  const canStart =
    !counting &&
    total >= 1 &&
    (all || currentSources.setIds.length + currentSources.collectionIds.length > 0);

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
        summary={counting ? "Đang tính thẻ…" : `${total} thẻ hợp lệ`}
        canStart={canStart}
        pending={false}
        pendingLabel="Đang tải…"
        startLabel="Bắt đầu kiểm tra"
        onStart={goToMode}
      />
    </div>
  );
}
