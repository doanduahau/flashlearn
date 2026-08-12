import { Sparkles } from "lucide-react";

import type { SevenDayInsight } from "@/features/statistics/utils/seven-day-insight";

export function SevenDayInsightCard({ insight }: Readonly<{ insight: SevenDayInsight }>) {
  return (
    <section
      aria-label="Thông tin 7 ngày vừa qua"
      className="rounded-xl border border-border-soft bg-surface p-2.5 sm:rounded-2xl sm:p-4"
    >
      <h2 className="flex items-center gap-1.5 text-xs text-text-secondary sm:text-sm">
        <Sparkles aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-achievement" />7 ngày vừa
        qua
      </h2>
      <p className="mt-1 text-sm leading-relaxed sm:text-base">{insight.message}</p>
    </section>
  );
}
