"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { LoadingDots } from "@/components/shared/loading-dots";

import {
  QuestionCountSelector,
  type CountOption,
} from "@/features/learning-modes/components/question-count-selector";
import { StickyStartBar } from "@/features/learning-modes/components/sticky-start-bar";
import type { MascotLevel } from "@/features/mascot/types/mascot-types";
import { SourceBrowser } from "@/features/source-selection/components/source-browser";
import type { SourceOption, SourcePage } from "@/features/source-selection/types/source-types";
import { DifficultySelector } from "@/features/runner/components/difficulty-selector";
import { getRunnerAvailability, startRunnerSession } from "@/features/runner/server/actions";
import type {
  RunnerDifficulty,
  RunnerQuestionCount,
  RunnerReplaySource,
} from "@/features/runner/types/runner-types";
import { buildRunnerSessionHref } from "@/features/runner/utils/runner-session-url";

const COUNT_DEBOUNCE_MS = 250;
const HIDDEN_NOTICE = "Một số thẻ bị ẩn vì không đủ đáp án sai khác trong thư viện.";

type SourceParams = { setIds: string[]; collectionIds: string[] };

function sameSources(a: SourceParams, b: SourceParams): boolean {
  return (
    a.setIds.length === b.setIds.length &&
    a.collectionIds.length === b.collectionIds.length &&
    a.setIds.every((id, index) => id === b.setIds[index]) &&
    a.collectionIds.every((id, index) => id === b.collectionIds[index])
  );
}

export function RunnerSetup({
  sourcePage,
  totalCards,
  mascotLevel,
}: Readonly<{ sourcePage: SourcePage; totalCards: number; mascotLevel: MascotLevel }>) {
  const router = useRouter();
  const [all, setAll] = useState(true);
  const [selected, setSelected] = useState<Map<string, SourceOption>>(() => new Map());
  const [count, setCount] = useState<RunnerQuestionCount>(12);
  const [difficulty, setDifficulty] = useState<RunnerDifficulty>("medium");
  const [availability, setAvailability] = useState<{
    eligibleCount: number;
    availableCounts: RunnerQuestionCount[];
    message: string | null;
    hiddenByEligibility: boolean;
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
        const result = await getRunnerAvailability({
          all,
          setIds: currentSources.setIds,
          collectionIds: currentSources.collectionIds,
          questionCount: 12,
          difficulty,
        });
        if (cancelled) return;
        if (result.ok) {
          setAvailability({
            eligibleCount: result.eligibleCount,
            availableCounts: result.eligibility.availableCounts,
            message: result.eligibility.message,
            hiddenByEligibility: result.eligibility.hiddenByEligibility,
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
  }, [all, currentSources, difficulty]);

  const counting =
    availability === null ||
    availability.all !== all ||
    !sameSources(availability.computedFor, currentSources);
  const eligible = availability?.eligibleCount ?? 0;
  const availableCounts = availability?.availableCounts ?? [];
  const baseMessage = availability?.message ?? null;
  const hiddenByEligibility = availability?.hiddenByEligibility ?? false;
  const options: CountOption[] = availableCounts.map((value) => ({
    value,
    label: `${value} câu`,
  }));
  const effectiveCount = options.some((option) => option.value === count)
    ? count
    : ((options[0]?.value as RunnerQuestionCount | undefined) ?? 12);

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
      const result = await startRunnerSession({
        all,
        setIds: currentSources.setIds,
        collectionIds: currentSources.collectionIds,
        questionCount: effectiveCount,
        difficulty,
      });
      if (!result.ok) {
        setPending(false);
        setError(result.error);
        return;
      }
      const replaySource: RunnerReplaySource = {
        all,
        setIds: currentSources.setIds,
        collectionIds: currentSources.collectionIds,
        questionCount: effectiveCount,
        difficulty,
      };
      router.push(buildRunnerSessionHref(result.session.runnerSessionId, replaySource));
    })();
  }

  const canStart = availableCounts.length > 0 && !counting && countError === null && !pending;

  const poolMessage =
    countError === null && !counting && availableCounts.length === 0
      ? (baseMessage ?? "Chưa đủ thẻ hợp lệ để bắt đầu Runner.")
      : null;
  const hiddenNotice = !counting && hiddenByEligibility ? HIDDEN_NOTICE : null;

  return (
    <div className="mt-2 space-y-3 pb-28 sm:mt-5 sm:space-y-4 md:pb-0">
      <DifficultySelector value={difficulty} onChange={setDifficulty} />

      <QuestionCountSelector
        options={options}
        value={effectiveCount}
        eligible={eligible}
        counting={counting}
        onChange={(next) => setCount(next as RunnerQuestionCount)}
      />

      {poolMessage ? (
        <p role="alert" className="text-danger">
          {poolMessage}
        </p>
      ) : null}
      {hiddenNotice ? (
        <p role="status" className="text-warning">
          {hiddenNotice}
        </p>
      ) : null}
      {!all && countError ? (
        <p role="alert" className="text-danger">
          {countError}
        </p>
      ) : null}

      <SourceBrowser
        path="/runner"
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
        summary={
          counting ? (
            <LoadingDots label="Đang tính thẻ" />
          ) : (
            `${all ? 0 : selectedSources.length} nguồn · ${eligible} thẻ`
          )
        }
        canStart={canStart}
        pending={pending}
        pendingLabel="Đang mở…"
        startLabel="Bắt đầu Runner"
        onStart={start}
      />
    </div>
  );
}
