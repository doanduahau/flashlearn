"use client";

import { Button } from "@/components/ui/button";

export type CountOption = { value: number; label: string };

export function QuestionCountSelector({
  options,
  value,
  eligible,
  counting,
  onChange,
}: Readonly<{
  options: readonly CountOption[];
  value: number;
  eligible: number;
  counting: boolean;
  onChange: (count: number) => void;
}>) {
  return (
    <section
      aria-labelledby="question-count-heading"
      className="rounded-2xl border border-border-soft bg-surface p-4"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="question-count-heading" className="text-sm font-semibold sm:text-base">
          Số câu
        </h2>
        <p aria-live="polite" className="text-xs text-text-secondary">
          {counting ? "Đang tính…" : `${eligible} thẻ hợp lệ`}
        </p>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Chọn số câu">
        {options.map((option) => (
          <Button
            type="button"
            key={option.value}
            size="sm"
            variant={value === option.value ? "soft" : "outline"}
            disabled={counting}
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className="flex-1 min-h-8 text-xs sm:min-h-9 sm:text-sm"
          >
            {option.label}
          </Button>
        ))}
      </div>
    </section>
  );
}
