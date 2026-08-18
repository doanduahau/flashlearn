"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { submitQuizAnswer } from "@/features/quiz/server/actions";
import { cn } from "@/lib/utils";

import { SessionExitButton } from "@/features/learning-modes/components/session-exit-button";
import { PauseOverlay } from "@/features/learning-modes/components/pause-overlay";
import { useVisibilityPause } from "@/features/learning-modes/hooks/use-visibility-pause";

const ADVANCE_DELAY_MS = 800;

export function QuizSession({
  sessionId,
  question,
  total,
  exitHref,
}: {
  sessionId: string;
  total: number;
  question: { id: string; position: number; prompt: string; choices: string[] };
  exitHref: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<boolean | null>(null);
  const [correctChoiceIndex, setCorrectChoiceIndex] = useState<number | null>(null);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const feedbackRef = useRef<HTMLParagraphElement>(null);
  const submittingRef = useRef(false);
  const advanceTimerRef = useRef<number | null>(null);
  const { isPaused, resume } = useVisibilityPause();

  useEffect(() => {
    headingRef.current?.focus();
    return () => {
      if (advanceTimerRef.current !== null) window.clearTimeout(advanceTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (feedback !== null) feedbackRef.current?.focus();
  }, [feedback]);

  const submit = () => {
    if (isPaused || pending || feedback !== null || submittingRef.current) return;

    if (selected === null) {
      setError("Hãy chọn một đáp án.");
      return;
    }

    submittingRef.current = true;
    setPending(true);
    void (async () => {
      try {
        const result = await submitQuizAnswer({
          questionId: question.id,
          selectedChoiceIndex: selected,
        });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setError(null);
        const correct = result.correct ?? false;
        const done = result.completed ?? false;
        setFeedback(correct);
        setCompleted(done);
        setCorrectChoiceIndex(result.correctChoiceIndex ?? null);
        if (done) {
          // Final answer: preserve the existing completion path (brief delay,
          // then the result page), unchanged from before.
          advanceTimerRef.current = window.setTimeout(
            () => router.push(`/quiz/${sessionId}/result`),
            ADVANCE_DELAY_MS,
          );
        } else if (correct) {
          // Non-final correct answer: keep the green feedback visible before
          // auto-advancing to the next question.
          advanceTimerRef.current = window.setTimeout(() => router.refresh(), ADVANCE_DELAY_MS);
        }
      } finally {
        submittingRef.current = false;
        setPending(false);
      }
    })();
  };

  const advance = () => {
    if (pending || feedback === null) return;
    if (completed) router.push(`/quiz/${sessionId}/result`);
    else router.refresh();
  };

  const labelClassName = (index: number) => {
    const base =
      "flex cursor-pointer items-start gap-3 rounded-2xl border-2 p-4 transition-all focus-within:ring-2 focus-within:ring-primary/40 focus-within:ring-offset-2";
    if (feedback === null) {
      return cn(
        base,
        selected === index
          ? "border-primary bg-primary-soft shadow-soft-card"
          : "border-border-soft bg-surface hover:bg-surface-subtle",
      );
    }
    if (feedback === false && index === selected) {
      return cn(base, "border-danger bg-danger-soft");
    }
    const isCorrectChoice =
      correctChoiceIndex !== null
        ? index === correctChoiceIndex
        : index === selected && feedback === true;
    if (isCorrectChoice) {
      return cn(base, "border-success bg-success-soft");
    }
    return cn(base, "border-border-soft bg-surface");
  };
  return (
    <>
      <main className="mx-auto w-full max-w-3xl p-4 sm:p-8">
        <div className="mb-4 flex items-center justify-start">
          <SessionExitButton fallbackHref={exitHref} />
        </div>
        <p className="text-sm text-text-secondary">
          Câu {question.position + 1} / {total}
        </p>
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="mt-3 max-h-[45vh] overflow-y-auto break-words whitespace-pre-wrap text-xl font-bold sm:text-2xl"
        >
          {question.prompt}
        </h1>
        <fieldset className="mt-6 space-y-3" aria-label="Các đáp án">
          {question.choices.map((choice, index) => (
            <label key={`${index}-${choice}`} className={labelClassName(index)}>
              <input
                type="radio"
                name="answer"
                className="sr-only"
                disabled={pending || feedback !== null}
                checked={selected === index}
                onChange={() => {
                  setSelected(index);
                  setError(null);
                }}
              />
              <span className="whitespace-pre-wrap break-words text-primary">{choice}</span>
            </label>
          ))}
        </fieldset>
        {feedback !== null ? (
          <p ref={feedbackRef} role="status" tabIndex={-1} className="mt-4 font-semibold">
            {feedback ? "Chính xác." : "Chưa chính xác."}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="mt-4 text-danger">
            {error}
          </p>
        ) : null}
        {feedback === null ? (
          <Button className="mt-6" type="button" onClick={submit} disabled={pending}>
            {pending ? "Đang chấm…" : "Xác nhận đáp án"}
          </Button>
        ) : feedback === true && !completed ? null : (
          <Button className="mt-6" type="button" onClick={advance} disabled={pending}>
            {completed ? "Xem kết quả" : "Câu tiếp theo"}
          </Button>
        )}
      </main>
      {isPaused ? <PauseOverlay onResume={resume} /> : null}
    </>
  );
}
