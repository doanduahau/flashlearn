"use client";

import { Button } from "@/components/ui/button";

export function QuestionCountSelector({
  counts,
  value,
  eligible,
  counting,
  suffix,
  allCount,
  onChange,
}: Readonly<{
  counts: readonly number[];
  value: number;
  eligible: number;
  counting: boolean;
  suffix?: string;
  allCount?: number | null;
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
      <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Chọn số câu">
        {counts.map((count) => (
          <Button
            type="button"
            key={count}
            size="sm"
            variant={value === count ? "soft" : "outline"}
            disabled={count > eligible || counting}
            aria-pressed={value === count}
            onClick={() => onChange(count)}
          >
            {count}
            {suffix ? ` ${suffix}` : ""}
          </Button>
        ))}
        {allCount !== undefined && allCount !== null && !counts.includes(allCount) ? (
          <Button
            type="button"
            size="sm"
            variant={value === allCount ? "soft" : "outline"}
            disabled={counting}
            aria-pressed={value === allCount}
            onClick={() => onChange(allCount)}
          >
            Tất cả ({allCount})
          </Button>
        ) : null}
      </div>
    </section>
  );
}
