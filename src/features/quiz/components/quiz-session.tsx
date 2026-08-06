"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { submitQuizAnswer } from "@/features/quiz/server/actions";
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
  const [error, setError] = useState<string | null>(null);
  const [pending, transition] = useTransition();
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);
  const submit = () => {
    if (selected === null) {
      setError("Hãy chọn một đáp án.");
      return;
    }
    transition(async () => {
      const result = await submitQuizAnswer({
        questionId: question.id,
        selectedChoiceIndex: selected,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setFeedback(result.correct ?? false);
      if (result.completed) router.push(`/quiz/${sessionId}/result`);
    });
  };
  return (
    <main className="mx-auto w-full max-w-3xl p-4 sm:p-8">
      <p className="text-sm text-text-secondary">
        Câu {question.position + 1} / {total}
      </p>
      <h1 ref={headingRef} tabIndex={-1} className="mt-3 whitespace-pre-wrap text-2xl font-bold">
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
              onChange={() => setSelected(index)}
            />
            <span className="whitespace-pre-wrap">{choice}</span>
          </label>
        ))}
      </fieldset>
      {feedback !== null ? (
        <p role="status" className="mt-4 font-semibold">
          {feedback ? "Chính xác." : "Chưa chính xác."}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-4 text-danger">
          {error}
        </p>
      ) : null}
      <Button
        className="mt-6"
        type="button"
        onClick={feedback === null ? submit : () => router.refresh()}
        disabled={pending}
      >
        {pending ? "Đang chấm…" : feedback === null ? "Xác nhận đáp án" : "Câu tiếp theo"}
      </Button>
    </main>
  );
}
