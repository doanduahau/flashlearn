import { Heart } from "lucide-react";

import { formatRunnerTime } from "../utils/format-runner-time";

export function RunnerHud({
  lives,
  elapsedMs,
  questionNumber,
  totalQuestions,
  question,
}: Readonly<{
  lives: number;
  elapsedMs: number;
  questionNumber: number;
  totalQuestions: number;
  question: string;
}>) {
  return (
    <div className="space-y-2 px-4 pt-4">
      <div className="flex items-center justify-between gap-3">
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
      <p className="text-base font-semibold leading-snug text-text-primary sm:text-lg">
        {question}
      </p>
    </div>
  );
}
