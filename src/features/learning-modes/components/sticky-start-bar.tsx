"use client";

import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { LoadingDots } from "@/components/shared/loading-dots";

export function StickyStartBar({
  summary,
  canStart,
  pending,
  pendingLabel,
  startLabel,
  onStart,
}: Readonly<{
  summary: ReactNode;
  canStart: boolean;
  pending: boolean;
  pendingLabel: string;
  startLabel: string;
  onStart: () => void;
}>) {
  return (
    <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-y border-border-soft bg-surface/95 p-3 shadow-[0_-8px_24px_rgba(39,93,70,0.08)] backdrop-blur md:sticky md:bottom-4 md:rounded-2xl md:border">
      <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-3 md:max-w-none">
        <p aria-live="polite" className="min-w-0 text-sm font-medium">
          {summary}
        </p>
        <Button
          type="button"
          className="min-h-11 shrink-0"
          onClick={onStart}
          disabled={pending || !canStart}
        >
          {pending ? <LoadingDots label={pendingLabel} /> : startLabel}
        </Button>
      </div>
    </div>
  );
}
