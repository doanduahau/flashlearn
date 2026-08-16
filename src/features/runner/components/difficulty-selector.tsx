"use client";

import { cn } from "@/lib/utils";
import type { RunnerDifficulty } from "../types/runner-types";
import { getRunnerDifficultyConfig, runnerDifficultyLabel } from "../utils/runner-difficulty";

const RUNNER_DIFFICULTY_OPTIONS: ReadonlyArray<RunnerDifficulty> = ["easy", "medium", "hard"];

export function DifficultySelector({
  value,
  onChange,
}: Readonly<{
  value: RunnerDifficulty;
  onChange: (difficulty: RunnerDifficulty) => void;
}>) {
  const config = getRunnerDifficultyConfig(value);
  const seconds = Math.round(config.timePerItemMs / 1000);

  return (
    <fieldset className="rounded-xl border border-border-soft bg-surface p-2.5 sm:p-3">
      <legend className="px-1 text-xs font-semibold sm:text-sm">Độ khó</legend>
      <div className="flex gap-1.5" role="group" aria-label="Chọn độ khó">
        {RUNNER_DIFFICULTY_OPTIONS.map((difficulty) => (
          <button
            key={difficulty}
            type="button"
            aria-pressed={value === difficulty}
            onClick={() => onChange(difficulty)}
            className={cn(
              "min-h-8 flex-1 rounded-lg border px-2 py-1 text-xs font-medium transition-colors sm:min-h-9 sm:text-sm",
              value === difficulty
                ? "border-primary bg-primary-soft text-primary-foreground"
                : "border-border-soft bg-surface hover:bg-surface-subtle",
            )}
          >
            {runnerDifficultyLabel(difficulty)}
          </button>
        ))}
      </div>
      <p aria-live="polite" className="mt-1 text-[11px] text-text-secondary">
        {runnerDifficultyLabel(value)} — {config.lives} mạng · {seconds} giây/đáp án
      </p>
    </fieldset>
  );
}
