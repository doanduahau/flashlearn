"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { submitQuizAnswer } from "@/features/quiz/server/actions";

const ADVANCE_DELAY_MS = 800;

export function QuizSession({
  sessionId,
  question,
  total,
}: {
  sessionId: string;
  total: number;
  question: { id: string; position: number; prompt: string; choices: string[] };
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<boolean | null>(null);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, transition] = useTransition();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const feedbackRef = useRef<HTMLParagraphElement>(null);
  const submittingRef = useRef(false);
  const advanceTimerRef = useRef<number | null>(null);

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
    if (pending || feedback !== null || submittingRef.current) return;

    if (selected === null) {
      setError("Hãy chọn một đáp án.");
      return;
    }

    submittingRef.current = true;
    transition(async () => {
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
        setFeedback(result.correct ?? false);
        setCompleted(result.completed ?? false);
        if (result.completed) {
          advanceTimerRef.current = window.setTimeout(
            () => router.push(`/quiz/${sessionId}/result`),
            ADVANCE_DELAY_MS,
          );
        } else if (result.correct) {
          advanceTimerRef.current = window.setTimeout(() => router.refresh(), ADVANCE_DELAY_MS);
        }
      } finally {
        submittingRef.current = false;
      }
    });
  };

  const advance = () => {
    if (pending || feedback === null) return;
    if (completed) router.push(`/quiz/${sessionId}/result`);
    else router.refresh();
  };
  return (
    <main className="mx-auto w-full max-w-3xl p-4 sm:p-8">
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
          <label
            key={`${index}-${choice}`}
            className="flex cursor-pointer gap-3 rounded-2xl border border-border-soft p-4"
          >
            <input
              type="radio"
              name="answer"
              disabled={pending || feedback !== null}
              checked={selected === index}
              onChange={() => {
                setSelected(index);
                setError(null);
              }}
            />
            <span className="whitespace-pre-wrap break-words">{choice}</span>
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
      ) : (
        <Button className="mt-6" type="button" onClick={advance} disabled={pending}>
          {completed ? "Xem kết quả" : "Câu tiếp theo"}
        </Button>
      )}
    </main>
  );
}
