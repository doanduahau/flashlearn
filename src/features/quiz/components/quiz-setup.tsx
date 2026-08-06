"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { SourceBrowser } from "@/features/source-selection/components/source-browser";
import type { SourceOption, SourcePage } from "@/features/source-selection/types/source-types";
import { QUIZ_MIN_QUESTIONS, type QuizMode } from "@/features/quiz/schemas/quiz-schema";
import { getQuizCardCount, startQuiz } from "@/features/quiz/server/actions";

const COUNT_DEBOUNCE_MS = 250;
const questionCounts = [10, 20, 30, 50];

const modes: Array<{ id: QuizMode; title: string; description: string }> = [
  {
    id: "balanced",
    title: "Cân bằng",
    description: "Ưu tiên thẻ mới, ít lặp lại và thường trả lời sai.",
  },
  {
    id: "never_tested",
    title: "Chưa kiểm tra",
    description: "Ưu tiên thẻ chưa từng xuất hiện, rồi dùng quy tắc cân bằng.",
  },
  {
    id: "wrong_answers",
    title: "Câu sai",
    description: "Ưu tiên các thẻ bạn đã trả lời sai, rồi dùng quy tắc cân bằng.",
  },
  {
    id: "pure_random",
    title: "Ngẫu nhiên",
    description: "Chọn ngẫu nhiên các thẻ duy nhất trong phạm vi.",
  },
];

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
  const [mode, setMode] = useState<QuizMode>("balanced");
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
  const effectiveCount = availableCounts.includes(count) ? count : (availableCounts[0] ?? 0);

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

  function submit(): void {
    transition(async () => {
      setError(null);
      const result = await startQuiz({
        all,
        setIds: currentSources.setIds,
        collectionIds: currentSources.collectionIds,
        mode,
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
    !pending &&
    !counting &&
    countError === null &&
    eligible >= QUIZ_MIN_QUESTIONS &&
    effectiveCount >= QUIZ_MIN_QUESTIONS;

  return (
    <div className="mt-6 space-y-6 pb-28 md:pb-0">
      <label className="flex min-h-12 gap-3 rounded-2xl border border-border-soft bg-surface p-4">
        <input type="radio" checked={all} onChange={() => setAll(true)} />
        <span className="min-w-0">
          <strong>Tất cả thẻ</strong>
          <br />
          <span className="text-sm text-text-secondary">{totalCards} thẻ duy nhất</span>
        </span>
      </label>
      <SourceBrowser
        path="/quiz"
        sourcePage={sourcePage}
        selected={selectedSources}
        onToggle={toggleSource}
      />
      <fieldset>
        <legend className="font-semibold">Chế độ tạo đề</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {modes.map((item) => (
            <label
              className="flex min-h-12 gap-3 rounded-xl border border-border-soft bg-surface p-3"
              key={item.id}
            >
              <input
                type="radio"
                name="quiz-mode"
                checked={mode === item.id}
                onChange={() => setMode(item.id)}
              />
              <span>
                <strong>{item.title}</strong>
                <br />
                <span className="text-sm text-text-secondary">{item.description}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <section aria-labelledby="question-count-heading">
        <h2 id="question-count-heading" className="font-semibold">
          Số câu hỏi
        </h2>
        <p aria-live="polite" className="mt-1 text-sm text-text-secondary">
          {counting ? "Đang tính số thẻ hợp lệ…" : `Có ${eligible} thẻ hợp lệ trong phạm vi.`}
        </p>
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Chọn số câu hỏi">
          {eligible < QUIZ_MIN_QUESTIONS ? (
            <Button type="button" variant="outline" disabled>
              Tất cả ({eligible})
            </Button>
          ) : (
            questionCounts.map((value) => (
              <Button
                type="button"
                key={value}
                variant={effectiveCount === value ? "soft" : "outline"}
                disabled={value > eligible || counting}
                aria-pressed={effectiveCount === value}
                onClick={() => setCount(value)}
              >
                {value}
              </Button>
            ))
          )}
        </div>
      </section>
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
      <QuizActionBar
        selectedCount={all ? 0 : selectedSources.length}
        eligible={eligible}
        count={effectiveCount}
        pending={pending}
        canStart={canStart}
        onStart={submit}
      />
    </div>
  );
}

function QuizActionBar({
  selectedCount,
  eligible,
  count,
  pending,
  canStart,
  onStart,
}: Readonly<{
  selectedCount: number;
  eligible: number;
  count: number;
  pending: boolean;
  canStart: boolean;
  onStart: () => void;
}>) {
  return (
    <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-y border-border-soft bg-surface/95 p-3 shadow-[0_-8px_24px_rgba(39,93,70,0.08)] backdrop-blur md:sticky md:bottom-4 md:rounded-2xl md:border">
      <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-3 md:max-w-none">
        <p aria-live="polite" className="min-w-0 text-sm font-medium">
          {selectedCount} nguồn · {eligible} thẻ · {count || 0} câu
        </p>
        <Button type="button" className="min-h-11 shrink-0" onClick={onStart} disabled={!canStart}>
          {pending ? "Đang tạo…" : "Bắt đầu kiểm tra"}
        </Button>
      </div>
    </div>
  );
}
