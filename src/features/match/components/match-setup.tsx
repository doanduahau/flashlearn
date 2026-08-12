"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { SourceBrowser } from "@/features/source-selection/components/source-browser";
import type { SourceOption, SourcePage } from "@/features/source-selection/types/source-types";
import { getMatchCardCount } from "@/features/match/server/actions";
import { getMatchEligibility } from "@/features/match/utils/match-session";
import { MATCH_QUESTION_COUNTS } from "@/features/match/types/match-types";
import { cn } from "@/lib/utils";

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
  const [count, setCount] = useState<12 | 18 | 24>(12);
  const [customCount, setCustomCount] = useState<{
    count: number;
    computedFor: SourceParams;
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
    if (all) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        const result = await getMatchCardCount({
          all: false,
          setIds: currentSources.setIds,
          collectionIds: currentSources.collectionIds,
          questionCount: 12,
        });
        if (cancelled) return;
        if (result.ok) {
          setCustomCount({ count: result.count, computedFor: currentSources });
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
    !all && (customCount === null || !sameSources(customCount.computedFor, currentSources));
  const eligible = all ? totalCards : (customCount?.count ?? 0);
  const { availableCounts, canStart, message } = getMatchEligibility(eligible);
  const effectiveCount = availableCounts.includes(count)
    ? count
    : ((availableCounts[0] as 12 | 18 | 24 | undefined) ?? 12);

  function toggleSource(source: SourceOption): void {
    setAll(false);
    setError(null);
    setCountError(null);
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
    setPending(true);
    void (async () => {
      const result = await getMatchCardCount({
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
      if (result.count < 12) {
        setPending(false);
        setError("Match yêu cầu ít nhất 12 thẻ hợp lệ.");
        return;
      }
      const query = new URLSearchParams();
      if (all) query.set("all", "1");
      if (currentSources.setIds.length) query.set("sets", currentSources.setIds.join(","));
      if (currentSources.collectionIds.length)
        query.set("collections", currentSources.collectionIds.join(","));
      query.set("count", String(effectiveCount));
      router.push(`/match/session?${query.toString()}`);
    })();
  }

  const canStartMatch = canStart && !counting && countError === null && !pending;

  return (
    <div className="mt-2 space-y-3 pb-28 sm:mt-5 sm:space-y-4 md:pb-0">
      <label className="flex min-h-10 gap-3 rounded-2xl border border-border-soft bg-surface p-2.5 sm:min-h-12 sm:p-4">
        <input type="radio" checked={all} onChange={() => setAll(true)} />
        <span className="min-w-0">
          <strong className="text-sm sm:text-base">Tất cả thẻ</strong>
          <br />
          <span className="text-xs text-text-secondary sm:text-sm">{totalCards} thẻ duy nhất</span>
        </span>
      </label>

      <SourceBrowser
        path="/study"
        sourcePage={sourcePage}
        selected={selectedSources}
        onToggle={toggleSource}
      />

      {!all && countError ? (
        <p role="alert" className="text-danger">
          {countError}
        </p>
      ) : null}

      <section
        aria-labelledby="match-count-heading"
        className="rounded-2xl border border-border-soft bg-surface p-4"
      >
        <div className="flex items-baseline justify-between gap-2">
          <h2 id="match-count-heading" className="text-sm font-semibold sm:text-base">
            Số câu
          </h2>
          <p aria-live="polite" className="text-xs text-text-secondary">
            {counting ? "Đang tính…" : `${eligible} thẻ hợp lệ`}
          </p>
        </div>
        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Chọn số câu">
          {MATCH_QUESTION_COUNTS.map((value) => (
            <Button
              type="button"
              key={value}
              size="sm"
              variant={effectiveCount === value ? "soft" : "outline"}
              disabled={!availableCounts.includes(value) || counting}
              aria-pressed={effectiveCount === value}
              onClick={() => setCount(value)}
            >
              {value} câu
            </Button>
          ))}
        </div>
        {message ? (
          <p role="alert" className="mt-2 text-sm text-text-secondary">
            {message}
          </p>
        ) : null}
      </section>

      {error ? (
        <p role="alert" className="text-danger">
          {error}
        </p>
      ) : null}

      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-y border-border-soft bg-surface/95 p-3 shadow-[0_-8px_24px_rgba(39,93,70,0.08)] backdrop-blur md:sticky md:bottom-4 md:rounded-2xl md:border">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-3 md:max-w-none">
          <p aria-live="polite" className="min-w-0 text-sm font-medium">
            {counting
              ? "Đang tính thẻ…"
              : `${all ? 0 : selectedSources.length} nguồn · ${eligible} thẻ`}
          </p>
          <Button
            type="button"
            className="min-h-11 shrink-0"
            onClick={start}
            disabled={!canStartMatch}
          >
            {pending ? "Đang mở…" : "Bắt đầu Match"}
          </Button>
        </div>
      </div>
    </div>
  );
}
