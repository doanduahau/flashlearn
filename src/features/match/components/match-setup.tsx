"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { ModeFilter } from "@/features/learning-modes/components/mode-filter";
import { QuestionCountSelector } from "@/features/learning-modes/components/question-count-selector";
import { StickyStartBar } from "@/features/learning-modes/components/sticky-start-bar";
import type { LearningFilter } from "@/features/learning-modes/types";
import { SourceBrowser } from "@/features/source-selection/components/source-browser";
import type { SourceOption, SourcePage } from "@/features/source-selection/types/source-types";
import { getMatchAvailability } from "@/features/match/server/actions";
import { MATCH_QUESTION_COUNTS } from "@/features/match/types/match-types";

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

export function MatchSetup({
  sourcePage,
  totalCards,
}: Readonly<{ sourcePage: SourcePage; totalCards: number }>) {
  const router = useRouter();
  const [all, setAll] = useState(true);
  const [selected, setSelected] = useState<Map<string, SourceOption>>(() => new Map());
  const [filter, setFilter] = useState<LearningFilter>("unseen");
  const [count, setCount] = useState<12 | 18 | 24>(12);
  const [availability, setAvailability] = useState<{
    eligibleCount: number;
    availableCounts: number[];
    message: string | null;
    computedFor: SourceParams;
    all: boolean;
  } | null>(null);
  const [countError, setCountError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

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
        const result = await getMatchAvailability({
          all,
          setIds: currentSources.setIds,
          collectionIds: currentSources.collectionIds,
          questionCount: 12,
        });
        if (cancelled) return;
        if (result.ok) {
          setAvailability({
            eligibleCount: result.eligibleCount,
            availableCounts: result.eligibility.availableCounts,
            message: result.eligibility.message,
            computedFor: currentSources,
            all,
          });
          setCountError(null);
        } else {
          setCountError(result.error);
        }
      })();
    }, COUNT_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [all, currentSources]);

  const counting =
    availability === null ||
    availability.all !== all ||
    !sameSources(availability.computedFor, currentSources);
  const eligible = availability?.eligibleCount ?? 0;
  const availableCounts = availability?.availableCounts ?? [];
  const message = availability?.message ?? null;
  const effectiveCount = availableCounts.includes(count)
    ? count
    : ((availableCounts[0] as 12 | 18 | 24 | undefined) ?? 12);

  function toggleSource(source: SourceOption): void {
    setAll(false);
    setError(null);
    setCountError(null);
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

  function start(): void {
    setError(null);
    setPending(true);
    void (async () => {
      const result = await getMatchAvailability({
        all,
        setIds: currentSources.setIds,
        collectionIds: currentSources.collectionIds,
        questionCount: effectiveCount,
      });
      if (!result.ok) {
        setPending(false);
        setError(result.error);
        return;
      }
      if (!result.eligibility.availableCounts.includes(effectiveCount)) {
        setPending(false);
        setError(result.eligibility.message ?? "Không thể tạo phiên Match với số câu này.");
        return;
      }
      const query = new URLSearchParams();
      if (all) query.set("all", "1");
      if (currentSources.setIds.length) query.set("sets", currentSources.setIds.join(","));
      if (currentSources.collectionIds.length)
        query.set("collections", currentSources.collectionIds.join(","));
      query.set("count", String(effectiveCount));
      query.set("filter", filter);
      router.push(`/match/session?${query.toString()}`);
    })();
  }

  const canStartMatch = availableCounts.length > 0 && !counting && countError === null && !pending;

  return (
    <div className="mt-2 space-y-3 pb-28 sm:mt-5 sm:space-y-4 md:pb-0">
      <ModeFilter value={filter} onChange={setFilter} />

      <QuestionCountSelector
        counts={MATCH_QUESTION_COUNTS}
        value={effectiveCount}
        eligible={eligible}
        counting={counting}
        suffix="câu"
        onChange={(next) => setCount(next as 12 | 18 | 24)}
      />

      {!all && countError ? (
        <p role="alert" className="text-danger">
          {countError}
        </p>
      ) : null}
      {message ? (
        <p role="alert" className="text-sm text-text-secondary">
          {message}
        </p>
      ) : null}

      <SourceBrowser
        path="/match"
        sourcePage={sourcePage}
        selected={selectedSources}
        onToggle={toggleSource}
        allCount={totalCards}
        allSelected={all}
        onSelectAll={selectAll}
      />

      {error ? (
        <p role="alert" className="text-danger">
          {error}
        </p>
      ) : null}

      <StickyStartBar
        summary={
          counting
            ? "Đang tính thẻ…"
            : `${all ? 0 : selectedSources.length} nguồn · ${eligible} thẻ`
        }
        canStart={canStartMatch}
        pending={pending}
        pendingLabel="Đang mở…"
        startLabel="Bắt đầu Match"
        onStart={start}
      />
    </div>
  );
}
