"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { CardCollectionsControl } from "@/features/special-collections/components/card-collections-control";
import type { StudyCard, StudyCollectionOption } from "@/features/study/types/study-types";
import { STUDY_MAX_CARDS } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function StudySession({
  cards,
  collections,
  membershipsByCard,
  truncated,
  seed,
  sessionHref,
}: Readonly<{
  cards: StudyCard[];
  collections: StudyCollectionOption[];
  membershipsByCard: Record<string, string[]>;
  truncated: boolean;
  seed?: number;
  sessionHref: string;
}>) {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const total = cards.length;
  const card = cards[currentIndex] ?? cards[0];
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === total - 1;

  const goPrevious = useCallback(() => {
    setIsFlipped(false);
    setCurrentIndex((index) => Math.max(0, index - 1));
  }, []);

  const goNext = useCallback(() => {
    setIsFlipped(false);
    setCurrentIndex((index) => Math.min(total - 1, index + 1));
  }, [total]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        typeof target.closest === "function" &&
        target.closest('button, input, textarea, select, [contenteditable="true"]')
      ) {
        return;
      }
      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        setIsFlipped((flipped) => !flipped);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        if (currentIndex < total - 1) goNext();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        if (currentIndex > 0) goPrevious();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [currentIndex, total, goNext, goPrevious]);

  function toggleShuffle(): void {
    const url = new URL(sessionHref, window.location.origin);
    if (seed !== undefined) {
      url.searchParams.delete("seed");
    } else {
      url.searchParams.set("seed", String(Math.floor(Math.random() * 4294967296)));
    }
    router.replace(`${url.pathname}${url.search}`, { scroll: false });
  }

  const progress = ((currentIndex + 1) / total) * 100;

  return (
    <main className="mx-auto w-full max-w-3xl p-4 sm:p-8">
      <div className="flex items-center justify-between">
        <Link href="/study" className="text-sm text-text-secondary hover:text-text-primary">
          ← Chọn phạm vi học
        </Link>
        <Button type="button" variant="ghost" onClick={() => router.push("/study")}>
          Thoát
        </Button>
      </div>

      <div
        role="progressbar"
        aria-label="Tiến độ phiên học"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={currentIndex + 1}
        className="mt-4 flex items-center gap-3"
      >
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-subtle">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-sm font-medium text-text-primary">
          {currentIndex + 1} / {total}
        </span>
      </div>

      <div
        className="relative mx-auto mt-6 w-full max-w-xl cursor-pointer select-none [perspective:1200px]"
        onClick={() => setIsFlipped((flipped) => !flipped)}
      >
        <div
          className={cn(
            "relative transition-transform duration-300 [transform-style:preserve-3d] motion-reduce:transition-none",
            isFlipped && "[transform:rotateY(180deg)]",
          )}
        >
          <div
            aria-hidden={isFlipped}
            className="flex min-h-72 w-full items-center justify-center rounded-3xl border border-border-soft bg-surface p-8 [backface-visibility:hidden]"
          >
            <p className="max-h-[55vh] overflow-y-auto whitespace-pre-wrap break-words text-center text-xl font-semibold leading-relaxed">
              {card.front}
            </p>
          </div>
          <div
            aria-hidden={!isFlipped}
            className="absolute inset-0 flex w-full items-center justify-center rounded-3xl border border-border-soft bg-primary-soft p-8 [backface-visibility:hidden] [transform:rotateY(180deg)]"
          >
            <p className="max-h-[55vh] overflow-y-auto whitespace-pre-wrap break-words text-center text-xl font-semibold leading-relaxed">
              {card.back}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button type="button" variant="outline" onClick={goPrevious} disabled={isFirst}>
          Thẻ trước
        </Button>
        <Button
          type="button"
          variant="soft"
          onClick={() => setIsFlipped((flipped) => !flipped)}
          aria-pressed={isFlipped}
        >
          {isFlipped ? "Nhấn để xem mặt trước" : "Nhấn để lật"}
        </Button>
        {isLast ? (
          <Button type="button" onClick={() => router.push("/study")}>
            Hoàn thành
          </Button>
        ) : (
          <Button type="button" onClick={goNext}>
            Thẻ tiếp theo
          </Button>
        )}
      </div>

      <div className="mt-6 rounded-2xl border border-border-soft bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-text-secondary">Bộ gốc</p>
            <p className="truncate font-semibold">{card.setName}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={toggleShuffle}
              aria-pressed={seed !== undefined}
            >
              {seed !== undefined ? "Bỏ trộn thứ tự" : "Trộn thứ tự"}
            </Button>
            <CardCollectionsControl
              key={card.id}
              cardId={card.id}
              setId={card.setId}
              collections={collections}
              memberships={membershipsByCard[card.id] ?? []}
            />
          </div>
        </div>
        {truncated ? (
          <p className="mt-3 text-sm text-text-secondary">
            Phiên giới hạn ở {STUDY_MAX_CARDS} thẻ. Hãy chọn phạm vi nhỏ hơn để ôn toàn bộ.
          </p>
        ) : null}
      </div>
    </main>
  );
}
