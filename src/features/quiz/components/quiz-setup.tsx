"use client";

import { Settings, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { SourceBrowser } from "@/features/source-selection/components/source-browser";
import type { SourceOption, SourcePage } from "@/features/source-selection/types/source-types";
import {
  QUIZ_MAX_QUESTIONS,
  QUIZ_MIN_QUESTIONS,
  type QuizMode,
} from "@/features/quiz/schemas/quiz-schema";
import { getQuizCardCount, startQuiz } from "@/features/quiz/server/actions";
import { cn } from "@/lib/utils";

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
  const [configOpen, setConfigOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

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

  // Sync dialog open/close with state
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (configOpen) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [configOpen]);

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

  const currentModeName = modes.find((m) => m.id === mode)?.title ?? mode;

  return (
    <div className="mt-2 space-y-3 pb-36 sm:mt-5 sm:space-y-4 md:pb-0">
      {/* "Tất cả thẻ" option */}
      <label className="flex min-h-10 gap-3 rounded-2xl border border-border-soft bg-surface p-2.5 sm:min-h-12 sm:p-4">
        <input type="radio" checked={all} onChange={() => setAll(true)} />
        <span className="min-w-0">
          <strong className="text-sm sm:text-base">Tất cả thẻ</strong>
          <br />
          <span className="text-xs text-text-secondary sm:text-sm">{totalCards} thẻ duy nhất</span>
        </span>
      </label>

      {/* Source browser — primary content */}
      <SourceBrowser
        path="/quiz"
        sourcePage={sourcePage}
        selected={selectedSources}
        onToggle={toggleSource}
      />

      {/* Desktop: show mode + count inline below source list */}
      <div className="hidden md:block">
        <QuizConfigInline
          mode={mode}
          setMode={setMode}
          effectiveCount={effectiveCount}
          setCount={setCount}
          eligible={eligible}
          counting={counting}
          allCountOption={allCountOption}
          countError={countError}
        />
      </div>

      {countError ? (
        <p role="alert" className="text-danger md:hidden">
          {countError}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-danger">
          {error}
        </p>
      ) : null}

      {/* Bottom action bar (mobile) + sticky (desktop) */}
      <QuizActionBar
        selectedCount={all ? 0 : selectedSources.length}
        eligible={eligible}
        count={effectiveCount}
        modeName={currentModeName}
        counting={counting}
        pending={pending}
        canStart={canStart}
        onStart={submit}
        onOpenConfig={() => setConfigOpen(true)}
      />

      {/* Mobile config bottom sheet */}
      <dialog
        ref={dialogRef}
        aria-label="Thiết lập bài kiểm tra"
        onClose={() => setConfigOpen(false)}
        onClick={(e) => {
          // Close when clicking backdrop
          if (e.target === dialogRef.current) setConfigOpen(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") setConfigOpen(false);
        }}
        className="m-0 mt-auto w-full max-w-full rounded-t-2xl border-0 bg-surface p-0 shadow-[0_-8px_32px_rgba(39,93,70,0.16)] backdrop:bg-black/40 md:hidden"
      >
        <div className="p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-bold">Thiết lập bài kiểm tra</h2>
            <button
              type="button"
              onClick={() => setConfigOpen(false)}
              aria-label="Đóng thiết lập"
              className="rounded-lg p-1.5 hover:bg-surface-subtle"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>
          <QuizConfigInline
            mode={mode}
            setMode={setMode}
            effectiveCount={effectiveCount}
            setCount={setCount}
            eligible={eligible}
            counting={counting}
            allCountOption={allCountOption}
            countError={countError}
          />
          <Button
            type="button"
            className="mt-4 w-full min-h-11"
            onClick={() => setConfigOpen(false)}
          >
            Xong
          </Button>
        </div>
      </dialog>
    </div>
  );
}

/** Shared config UI used in both desktop inline and mobile bottom sheet */
function QuizConfigInline({
  mode,
  setMode,
  effectiveCount,
  setCount,
  eligible,
  counting,
  allCountOption,
  countError,
}: Readonly<{
  mode: QuizMode;
  setMode: (m: QuizMode) => void;
  effectiveCount: number;
  setCount: (n: number) => void;
  eligible: number;
  counting: boolean;
  allCountOption: boolean;
  countError: string | null;
}>) {
  return (
    <div className="space-y-4">
      {/* Mode chips */}
      <fieldset>
        <legend className="text-sm font-semibold sm:text-base">Chế độ tạo đề</legend>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {modes.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={mode === item.id}
              onClick={() => setMode(item.id)}
              title={item.description}
              className={cn(
                "rounded-xl border px-3 py-2 text-sm font-medium transition-colors",
                mode === item.id
                  ? "border-primary bg-primary-soft text-primary-foreground"
                  : "border-border-soft bg-surface hover:bg-surface-subtle",
              )}
            >
              {item.title}
            </button>
          ))}
        </div>
      </fieldset>

      {/* Count chips */}
      <section aria-labelledby="question-count-heading">
        <div className="flex items-baseline justify-between gap-2">
          <h2 id="question-count-heading" className="text-sm font-semibold sm:text-base">
            Số câu hỏi
          </h2>
          <p aria-live="polite" className="text-xs text-text-secondary">
            {counting ? "Đang tính…" : `${eligible} thẻ hợp lệ`}
          </p>
        </div>
        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Chọn số câu hỏi">
          {eligible < QUIZ_MIN_QUESTIONS ? (
            <Button type="button" variant="outline" size="sm" disabled>
              Tất cả ({eligible})
            </Button>
          ) : (
            <>
              {questionCounts.map((value) => (
                <Button
                  type="button"
                  key={value}
                  size="sm"
                  variant={effectiveCount === value ? "soft" : "outline"}
                  disabled={value > eligible || counting}
                  aria-pressed={effectiveCount === value}
                  onClick={() => setCount(value)}
                >
                  {value}
                </Button>
              ))}
              {allCountOption ? (
                <Button
                  type="button"
                  size="sm"
                  variant={effectiveCount === eligible ? "soft" : "outline"}
                  disabled={counting}
                  aria-pressed={effectiveCount === eligible}
                  onClick={() => setCount(eligible)}
                >
                  Tất cả ({eligible})
                </Button>
              ) : null}
            </>
          )}
        </div>
        {countError ? (
          <p role="alert" className="mt-2 text-sm text-danger">
            {countError}
          </p>
        ) : null}
      </section>
    </div>
  );
}

function QuizActionBar({
  selectedCount,
  eligible,
  count,
  modeName,
  counting,
  pending,
  canStart,
  onStart,
  onOpenConfig,
}: Readonly<{
  selectedCount: number;
  eligible: number;
  count: number;
  modeName: string;
  counting: boolean;
  pending: boolean;
  canStart: boolean;
  onStart: () => void;
  onOpenConfig: () => void;
}>) {
  return (
    <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 mb-0 border-y border-border-soft bg-surface/95 p-2.5 shadow-[0_-8px_24px_rgba(39,93,70,0.08)] backdrop-blur sm:p-3 md:sticky md:bottom-4 md:rounded-2xl md:border">
      <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-2 md:max-w-none">
        {/* Mobile: summary + config icon */}
        <div className="flex min-w-0 flex-1 flex-col items-start gap-0.5 md:hidden">
          <button
            type="button"
            aria-label="Thiết lập bài kiểm tra"
            onClick={onOpenConfig}
            className="flex shrink-0 items-center gap-1.5 rounded-xl border border-border-soft bg-surface px-2.5 py-1.5 text-xs font-medium hover:bg-surface-subtle"
          >
            <Settings className="size-3.5 shrink-0" aria-hidden="true" />
            <span>{modeName}</span>
          </button>
          <p aria-live="polite" className="min-w-0 max-w-full truncate text-xs text-text-secondary">
            {counting ? "Đang tính thẻ…" : `${count || 0} câu · ${eligible} thẻ`}
          </p>
        </div>

        {/* Desktop: text summary */}
        <p aria-live="polite" className="hidden min-w-0 text-sm font-medium md:block">
          {selectedCount} nguồn · {eligible} thẻ · {count || 0} câu
        </p>

        <Button
          type="button"
          className="min-h-9 shrink-0 sm:min-h-11"
          onClick={onStart}
          disabled={!canStart}
        >
          {pending ? "Đang tạo…" : "Bắt đầu kiểm tra"}
        </Button>
      </div>
    </div>
  );
}
