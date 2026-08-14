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
    <fieldset className="rounded-2xl border border-border-soft bg-surface p-4">
      <legend className="px-1 text-sm font-semibold sm:text-base">Độ khó</legend>
      <div className="flex gap-2" role="group" aria-label="Chọn độ khó">
        {RUNNER_DIFFICULTY_OPTIONS.map((difficulty) => (
          <button
            key={difficulty}
            type="button"
            aria-pressed={value === difficulty}
            onClick={() => onChange(difficulty)}
            className={cn(
              "min-h-10 flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition-colors",
              value === difficulty
                ? "border-primary bg-primary-soft text-primary-foreground"
                : "border-border-soft bg-surface hover:bg-surface-subtle",
            )}
          >
            {runnerDifficultyLabel(difficulty)}
          </button>
        ))}
      </div>
      <p aria-live="polite" className="mt-2 text-xs text-text-secondary">
        {runnerDifficultyLabel(value)} — {config.lives} mạng · {seconds} giây/đáp án
      </p>
    </fieldset>
  );
}
