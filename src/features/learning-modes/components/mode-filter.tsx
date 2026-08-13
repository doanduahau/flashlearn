"use client";

import { cn } from "@/lib/utils";
import { LEARNING_FILTER_OPTIONS, type LearningFilter } from "../types";

export function ModeFilter({
  value,
  onChange,
}: Readonly<{
  value: LearningFilter;
  onChange: (filter: LearningFilter) => void;
}>) {
  return (
    <fieldset className="rounded-2xl border border-border-soft bg-surface p-4">
      <legend className="px-1 text-sm font-semibold sm:text-base">Chế độ</legend>
      <div className="flex gap-2" role="group" aria-label="Chọn chế độ">
        {LEARNING_FILTER_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              "min-h-10 flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition-colors",
              value === option.value
                ? "border-primary bg-primary-soft text-primary-foreground"
                : "border-border-soft bg-surface hover:bg-surface-subtle",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
