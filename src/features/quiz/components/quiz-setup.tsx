"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { ModeFilter } from "@/features/learning-modes/components/mode-filter";
import { QuestionCountSelector } from "@/features/learning-modes/components/question-count-selector";
import { StickyStartBar } from "@/features/learning-modes/components/sticky-start-bar";
import { learningFilterToQuizMode, type LearningFilter } from "@/features/learning-modes/types";
import { SourceBrowser } from "@/features/source-selection/components/source-browser";
import type { SourceOption, SourcePage } from "@/features/source-selection/types/source-types";
import { QUIZ_MAX_QUESTIONS, QUIZ_MIN_QUESTIONS } from "@/features/quiz/schemas/quiz-schema";
import { getQuizCardCount, startQuiz } from "@/features/quiz/server/actions";

const COUNT_DEBOUNCE_MS = 250;
const questionCounts = [10, 20, 30, 50];

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
}: Readonly<{
  sourcePage: SourcePage;
  totalCards: number;
}>) {
  const router = useRouter();
  const [all, setAll] = useState(true);
  const [selected, setSelected] = useState<Map<string, SourceOption>>(() => new Map());
  const [filter, setFilter] = useState<LearningFilter>("unseen");
  const [count, setCount] = useState(QUIZ_MIN_QUESTIONS);
  const [customCount, setCustomCount] = useState<{
    count: number;
    computedFor: SourceParams;
  } | null>(null);
  const [countError, setCountError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, transition] = useTransition();

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
        const result = await getQuizCardCount(currentSources);
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
  const availableCounts = questionCounts.filter((value) => value <= eligible);
  const allCountOption =
    eligible >= QUIZ_MIN_QUESTIONS &&
    eligible <= QUIZ_MAX_QUESTIONS &&
    !questionCounts.includes(eligible);
  const effectiveCount =
    availableCounts.includes(count) || (allCountOption && count === eligible)
      ? count
      : (availableCounts[0] ?? 0);

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
    setCountError(null);
  }

  function submit(): void {
    transition(async () => {
      setError(null);
      const result = await startQuiz({
        all,
        setIds: currentSources.setIds,
        collectionIds: currentSources.collectionIds,
        mode: learningFilterToQuizMode(filter),
        questionCount: effectiveCount,
      });
      if (!result.ok || !result.sessionId) {
        setError(result.ok ? "Không thể tạo bài kiểm tra." : result.error);
        return;
      }
      router.push(`/quiz/${result.sessionId}`);
    });
  }

  const canStart =
    !pending && !counting && countError === null && effectiveCount >= QUIZ_MIN_QUESTIONS;

  return (
    <div className="mt-2 space-y-3 pb-28 sm:mt-5 sm:space-y-4 md:pb-0">
      <ModeFilter value={filter} onChange={setFilter} />

      <QuestionCountSelector
        counts={questionCounts}
        value={effectiveCount}
        eligible={eligible}
        counting={counting}
        allCount={allCountOption ? eligible : undefined}
        onChange={setCount}
      />

      <SourceBrowser
        path="/quiz"
        sourcePage={sourcePage}
        selected={selectedSources}
        onToggle={toggleSource}
        allCount={totalCards}
        allSelected={all}
        onSelectAll={selectAll}
      />

      {countError ? (
        <p role="alert" className="text-danger">
          {countError}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-danger">
          {error}
        </p>
      ) : null}

      <StickyStartBar
        summary={counting ? "Đang tính thẻ…" : `${effectiveCount || 0} câu · ${eligible} thẻ`}
        canStart={canStart}
        pending={pending}
        pendingLabel="Đang tạo…"
        startLabel="Bắt đầu kiểm tra"
        onStart={submit}
      />
    </div>
  );
}
