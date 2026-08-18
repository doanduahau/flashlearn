"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { BackButton } from "@/components/shared/back-button";
import { BrandLoading } from "@/components/shared/brand-loading";
import { Button } from "@/components/ui/button";
import { MascotImage } from "@/features/mascot/components/mascot-image";
import type { MascotLevel } from "@/features/mascot/types/mascot-types";
import { CardCollectionsControl } from "@/features/special-collections/components/card-collections-control";
import { SessionExitButton } from "@/features/learning-modes/components/session-exit-button";
import { PauseOverlay } from "@/features/learning-modes/components/pause-overlay";
import { useVisibilityPause } from "@/features/learning-modes/hooks/use-visibility-pause";
import { recordDailyActivity } from "@/features/learning-modes/server/record-activity";
import {
  retryTypingSave,
  startTypingSession,
  submitTypingAttempt,
} from "@/features/typing/server/actions";
import type {
  StartedTypingSession,
  TypingSubmitResult,
} from "@/features/typing/types/typing-types";
import { cn } from "@/lib/utils";

type TypingSessionProps = {
  sessionHref: string;
  questionCount: number;
  exitHref: string;
  mascotLevel: MascotLevel;
};

function sourceFromHref(sessionHref: string) {
  const url = new URL(sessionHref, window.location.origin);
  return {
    all: url.searchParams.get("all") === "1",
    setIds: (url.searchParams.get("sets") ?? "").split(",").filter(Boolean),
    collectionIds: (url.searchParams.get("collections") ?? "").split(",").filter(Boolean),
  };
}

export function TypingSession({
  sessionHref,
  questionCount,
  exitHref,
  mascotLevel,
}: Readonly<TypingSessionProps>) {
  const router = useRouter();
  const [session, setSession] = useState<StartedTypingSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [completionError, setCompletionError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [result, setResult] = useState<TypingSubmitResult | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [pending, setPending] = useState(false);
  const completingRef = useRef(false);
  const startedAtRef = useRef(0);
  const retryPayloadRef = useRef<{
    coverageSessionId: string;
    sourceSetIds: string[];
    sourceCollectionIds: string[];
    sourceAll: boolean;
    totalQuestions: number;
    correctCount: number;
    elapsedMs: number;
    answers: Array<{ flashcardId: string; isCorrect: boolean }>;
  } | null>(null);
  const { isPaused, resume } = useVisibilityPause();

  const loadSession = useCallback(async () => {
    setSession(null);
    setError(null);
    setCompletionError(null);
    setSaveError(null);
    setResult(null);
    setCurrentIndex(0);
    setAnswers({});
    setConfirmSubmit(false);
    const outcome = await startTypingSession({
      ...sourceFromHref(sessionHref),
      questionCount,
    });
    if (!outcome.ok) {
      setCompletionError(outcome.error);
      return;
    }
    startedAtRef.current = Date.now();
    setSession(outcome.session);
  }, [questionCount, sessionHref]);

  useEffect(() => {
    let cancelled = false;
    void startTypingSession({ ...sourceFromHref(sessionHref), questionCount }).then((outcome) => {
      if (cancelled) return;
      if (!outcome.ok) {
        setError(outcome.error);
        return;
      }
      startedAtRef.current = Date.now();
      setSession(outcome.session);
    });
    return () => {
      cancelled = true;
    };
  }, [questionCount, sessionHref]);

  const unansweredCount = session
    ? session.cards.filter((card) => !(answers[card.id] ?? "").trim()).length
    : 0;

  function handleAnswerChange(cardId: string, value: string): void {
    setAnswers((prev) => ({ ...prev, [cardId]: value }));
    setConfirmSubmit(false);
  }

  function handleSubmitClick(): void {
    if (!session) return;
    if (unansweredCount > 0 && !confirmSubmit) {
      setConfirmSubmit(true);
      return;
    }
    void submit();
  }

  async function submit(): Promise<void> {
    if (!session || completingRef.current) return;
    completingRef.current = true;
    setPending(true);
    try {
      const source = sourceFromHref(sessionHref);
      const outcome = await submitTypingAttempt({
        coverageSessionId: session.coverageSessionId,
        sourceSetIds: source.setIds,
        sourceCollectionIds: source.collectionIds,
        sourceAll: source.all,
        totalQuestions: questionCount,
        elapsedMs: Math.max(0, Date.now() - startedAtRef.current),
        answers: session.cards.map((card) => ({
          flashcardId: card.id,
          answer: answers[card.id] ?? "",
        })),
      });
      if (!outcome.ok) {
        setError(outcome.error);
        return;
      }
      retryPayloadRef.current = {
        coverageSessionId: session.coverageSessionId,
        sourceSetIds: source.setIds,
        sourceCollectionIds: source.collectionIds,
        sourceAll: source.all,
        totalQuestions: questionCount,
        correctCount: outcome.result.correctCount,
        elapsedMs: Math.max(0, Date.now() - startedAtRef.current),
        answers: outcome.result.questions.map((question) => ({
          flashcardId: question.flashcardId,
          isCorrect: question.isCorrect,
        })),
      };
      setSaveError(outcome.saveError);
      if (outcome.saveError === null) {
        const record = await recordDailyActivity({
          mode: "typing",
          questionsAnswered: questionCount,
          correctAnswers: outcome.result.correctCount,
        });
        if (!record.ok) {
          setSaveError(record.error);
        } else {
          router.refresh();
        }
      }
      setResult(outcome.result);
    } finally {
      completingRef.current = false;
      setPending(false);
    }
  }

  async function retrySave(): Promise<void> {
    if (completingRef.current || !retryPayloadRef.current) return;
    completingRef.current = true;
    try {
      const outcome = await retryTypingSave(retryPayloadRef.current);
      if (!outcome.ok) {
        setSaveError(outcome.error);
      } else {
        setSaveError(null);
        const record = await recordDailyActivity({
          mode: "typing",
          questionsAnswered: retryPayloadRef.current.totalQuestions,
          correctAnswers: retryPayloadRef.current.correctCount,
        });
        if (!record.ok) {
          setSaveError(record.error);
        } else {
          router.refresh();
        }
      }
    } finally {
      completingRef.current = false;
    }
  }

  function replay(): void {
    setResult(null);
    void loadSession();
  }

  if (error) {
    return (
      <div className="space-y-4">
        <p
          role="alert"
          className="rounded-2xl border border-border-soft bg-surface p-4 text-danger"
        >
          {error}
        </p>
        <BackButton fallbackHref="/quiz/mode" />
      </div>
    );
  }
  if (!session) return <BrandLoading title="Đang tải thẻ" />;
  if (result) {
    const percentage = Math.round((result.correctCount / result.totalCount) * 100);
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <MascotImage
            level={mascotLevel}
            state={percentage >= 60 ? "happy" : "sad"}
            size={80}
            className="size-16 shrink-0 object-contain sm:size-20"
          />
          <div>
            <h1 className="text-3xl font-bold">Kết quả kiểm tra</h1>
            <p className="mt-3 text-xl">
              {result.correctCount}/{result.totalCount} đúng ({percentage}%)
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button type="button" onClick={replay}>
            Chơi lại
          </Button>
          <BackButton fallbackHref="/quiz/mode" />
        </div>
        {saveError ? (
          <div
            role="alert"
            className="flex flex-col gap-2 rounded-2xl border border-border-soft bg-surface p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <p className="text-sm text-danger">{saveError}</p>
            <Button type="button" variant="outline" onClick={() => void retrySave()}>
              Thử lại lưu kết quả
            </Button>
          </div>
        ) : null}
        <section className="space-y-4" aria-label="Xem lại câu trả lời">
          {result.questions.map((question, index) => (
            <article
              key={question.flashcardId}
              className="rounded-2xl border border-border-soft p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="whitespace-pre-wrap font-semibold">
                  {index + 1}. {question.front}
                </p>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <span
                    className={cn(
                      "rounded-full px-3 py-1 text-sm font-semibold",
                      question.isCorrect
                        ? "bg-success/10 text-success"
                        : "bg-danger/10 text-danger",
                    )}
                  >
                    {question.isCorrect ? "✓ Đúng" : "✗ Sai"}
                  </span>
                  {!question.isCorrect ? (
                    <CardCollectionsControl
                      cardId={question.flashcardId}
                      setId={question.setId}
                      collections={result.collections}
                      memberships={result.membershipsByCard[question.flashcardId] ?? []}
                      variant="icon"
                    />
                  ) : null}
                </div>
              </div>
              <p className="mt-2">
                Đáp án của bạn:{" "}
                <span className={cn("whitespace-pre-wrap", !question.isCorrect && "text-danger")}>
                  {question.userAnswer.trim() || "Chưa trả lời"}
                </span>
              </p>
              <p className="mt-1">
                Đáp án đúng:{" "}
                <span className="whitespace-pre-wrap text-success">{question.back}</span>
              </p>
            </article>
          ))}
        </section>
      </div>
    );
  }
  if (completionError) {
    return (
      <div className="space-y-4">
        <p
          role="alert"
          className="rounded-2xl border border-border-soft bg-surface p-4 text-danger"
        >
          {completionError}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => void loadSession()}>
            Thử lại
          </Button>
          <BackButton fallbackHref="/quiz/mode" />
        </div>
      </div>
    );
  }

  const card = session.cards[currentIndex];
  if (!card) return null;
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === session.cards.length - 1;

  function goPrevious(): void {
    if (!isFirst) setCurrentIndex((index) => index - 1);
  }

  function goNext(): void {
    if (!isLast) setCurrentIndex((index) => index + 1);
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-start">
        <SessionExitButton fallbackHref={exitHref} />
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-text-secondary">
          Câu {currentIndex + 1} / {session.cards.length}
        </p>
        <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-subtle">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{
              width: `${((currentIndex + 1) / session.cards.length) * 100}%`,
            }}
          />
        </div>
      </div>
      <div className="mt-6 flex min-h-56 flex-col items-center justify-center rounded-3xl border border-border-soft bg-surface p-6 text-center shadow-soft-card">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Câu hỏi</p>
        <p className="mt-3 whitespace-pre-wrap text-xl font-semibold leading-relaxed sm:text-2xl">
          {card.front}
        </p>
      </div>
      <label className="mt-6 block">
        <span className="text-sm font-medium text-text-secondary">Đáp án của bạn</span>
        <textarea
          value={answers[card.id] ?? ""}
          onChange={(event) => handleAnswerChange(card.id, event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              goNext();
            }
          }}
          rows={3}
          placeholder="Nhập đáp án…"
          aria-label={`Đáp án cho câu ${currentIndex + 1}`}
          className="mt-2 w-full rounded-2xl border border-border-soft bg-surface p-4 text-base outline-none transition-colors placeholder:text-text-secondary/60 focus:border-primary"
        />
      </label>{" "}
      <div className="mt-6 grid grid-cols-2 gap-3">
        <Button type="button" variant="soft" onClick={goPrevious} disabled={isFirst}>
          Câu trước
        </Button>
        <Button type="button" variant="soft" onClick={goNext} disabled={isLast}>
          Câu sau
        </Button>
      </div>
      <div className="mt-4">
        <Button type="button" onClick={handleSubmitClick} disabled={pending} className="w-full">
          {pending ? "Đang chấm điểm…" : "Nộp bài"}
        </Button>
        {confirmSubmit ? (
          <p role="alert" className="mt-2 text-center text-sm text-warning">
            Còn {unansweredCount} câu chưa trả lời — bấm Nộp bài lần nữa để nộp (câu trống tính là
            sai).
          </p>
        ) : null}
      </div>
      {isPaused ? <PauseOverlay onResume={resume} /> : null}
    </>
  );
}
