import { ChevronLeft, Heart } from "lucide-react";

import { formatRunnerTime } from "../utils/format-runner-time";

export function RunnerHud({
  lives,
  elapsedMs,
  questionNumber,
  totalQuestions,
  question,
  onBack,
}: Readonly<{
  lives: number;
  elapsedMs: number;
  questionNumber: number;
  totalQuestions: number;
  question: string;
  onBack?: () => void;
}>) {
  return (
    <div className="space-y-2 px-4 pt-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              aria-label="Quay lại"
              className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border-soft bg-surface text-text-primary hover:bg-surface-subtle"
            >
              <ChevronLeft className="size-6" aria-hidden="true" />
            </button>
          ) : null}
          <div className="flex gap-1" role="img" aria-label={`${lives} mạng`}>
            {Array.from({ length: lives }, (_, index) => (
              <Heart
                key={index}
                className="size-5 text-danger"
                fill="currentColor"
                aria-hidden="true"
              />
            ))}
          </div>
        </div>
        <span
          className="font-mono text-sm font-semibold text-text-secondary"
          aria-label="Thời gian"
        >
          {formatRunnerTime(elapsedMs)}
        </span>
        <span className="text-sm font-semibold text-text-secondary">
          Câu {questionNumber} / {totalQuestions}
        </span>
      </div>
      <p className="text-center text-lg font-semibold leading-snug text-text-primary sm:text-xl">
        {question}
      </p>
    </div>
  );
}
