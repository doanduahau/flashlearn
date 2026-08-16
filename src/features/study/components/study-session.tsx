"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { BackButton } from "@/components/shared/back-button";
import { Button } from "@/components/ui/button";
import { SessionExitButton } from "@/features/learning-modes/components/session-exit-button";
import { MascotImage } from "@/features/mascot/components/mascot-image";
import type { MascotLevel } from "@/features/mascot/types/mascot-types";
import { CardCollectionsControl } from "@/features/special-collections/components/card-collections-control";
import { studyModeHrefFromSession } from "@/features/study/utils/study-mode-href";
import type { StudyCard, StudyCollectionOption } from "@/features/study/types/study-types";
import { STUDY_MAX_CARDS } from "@/lib/constants";
import { cn } from "@/lib/utils";

const SWIPE_THRESHOLD = 56;
const SWIPE_RATIO = 1.2;
const CLICK_SLOP = 8;
const INTERACTIVE_SELECTOR =
  'a, button, input, textarea, select, [role="button"], [contenteditable="true"]';

export function StudySession({
  cards,
  collections,
  membershipsByCard,
  truncated,
  seed,
  sessionHref,
  mascotLevel,
}: Readonly<{
  cards: StudyCard[];
  collections: StudyCollectionOption[];
  membershipsByCard: Record<string, string[]>;
  truncated: boolean;
  seed?: number;
  sessionHref: string;
  mascotLevel: MascotLevel;
}>) {
  const router = useRouter();
  const fallbackHref = studyModeHrefFromSession(sessionHref);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  const gestureRef = useRef<{ startX: number; startY: number; active: boolean } | null>(null);
  const didMoveRef = useRef(false);

  const total = cards.length;
  const card = cards[currentIndex] ?? cards[0];
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === total - 1;
  const exitHref = studyModeHrefFromSession(sessionHref);

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
      if (isCompleted) return;
      const target = event.target as HTMLElement | null;
      if (target && typeof target.closest === "function" && target.closest(INTERACTIVE_SELECTOR)) {
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
  }, [currentIndex, total, goNext, goPrevious, isCompleted]);

  function toggleShuffle(): void {
    const url = new URL(sessionHref, window.location.origin);
    if (seed !== undefined) {
      url.searchParams.delete("seed");
    } else {
      url.searchParams.set("seed", String(Math.floor(Math.random() * 4294967296)));
    }
    router.replace(`${url.pathname}${url.search}`, { scroll: false });
  }

  function handleReplay(): void {
    setIsCompleted(false);
    setCurrentIndex(0);
    setIsFlipped(false);
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>): void {
    const target = event.target as HTMLElement | null;
    if (
      event.button !== 0 ||
      (target && typeof target.closest === "function" && target.closest(INTERACTIVE_SELECTOR))
    ) {
      gestureRef.current = null;
      didMoveRef.current = false;
      return;
    }
    gestureRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      active: true,
    };
    didMoveRef.current = false;
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>): void {
    const gesture = gestureRef.current;
    if (!gesture?.active) return;
    const dx = Math.abs(event.clientX - gesture.startX);
    const dy = Math.abs(event.clientY - gesture.startY);
    if (dx > CLICK_SLOP || dy > CLICK_SLOP) {
      didMoveRef.current = true;
    }
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>): void {
    const gesture = gestureRef.current;
    gestureRef.current = null;
    if (!gesture?.active) return;
    const dx = event.clientX - gesture.startX;
    const dy = event.clientY - gesture.startY;
    if (Math.abs(dx) < SWIPE_THRESHOLD) return;
    if (Math.abs(dx) <= Math.abs(dy) * SWIPE_RATIO) return;
    if (dx < 0) {
      goNext();
    } else {
      goPrevious();
    }
  }

  function handlePointerCancel(): void {
    gestureRef.current = null;
  }

  function handleCardClick(): void {
    if (didMoveRef.current) {
      didMoveRef.current = false;
      return;
    }
    setIsFlipped((flipped) => !flipped);
  }

  const progress = ((currentIndex + 1) / total) * 100;

  if (isCompleted) {
    return (
      <main className="mx-auto w-full max-w-3xl p-4 sm:p-8">
        <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
          <MascotImage
            level={mascotLevel}
            state="congrats"
            size={144}
            className="size-36 object-contain"
            aria-hidden
          />
          <h2 className="text-xl font-bold sm:text-2xl">Hoàn thành!</h2>
          <p className="text-sm text-text-secondary">Đã xem {total} thẻ</p>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            <Button type="button" variant="soft" onClick={handleReplay}>
              Chơi lại
            </Button>
            <BackButton fallbackHref={fallbackHref} />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl p-4 sm:p-8">
      <div className="flex justify-start">
        <SessionExitButton fallbackHref={exitHref} />
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

      <div className="mt-6 flex items-center justify-center gap-2">
        <Button
          type="button"
          variant="soft"
          className="size-12 shrink-0 rounded-full p-0"
          onClick={() => goPrevious()}
          disabled={isFirst}
          aria-label="Thẻ trước"
        >
          <ChevronLeft aria-hidden="true" className="size-6" />
        </Button>

        <div
          data-testid="study-card"
          className="relative min-w-0 flex-1 [touch-action:pan-y]"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
        >
          <div
            key={card.id}
            className="animate-card-in cursor-pointer select-none [perspective:1200px] motion-reduce:animate-none"
            onClick={handleCardClick}
          >
            <div
              className={cn(
                "relative transition-transform duration-300 [transform-style:preserve-3d] motion-reduce:transition-none",
                isFlipped && "[transform:rotateY(180deg)]",
              )}
            >
              <div
                aria-hidden={isFlipped}
                className="flex min-h-72 w-full items-center justify-center rounded-3xl border border-border-soft bg-surface px-4 py-6 [backface-visibility:hidden] sm:px-8 sm:py-8"
              >
                <p className="max-h-[55vh] overflow-y-auto break-words whitespace-pre-wrap text-center text-lg font-semibold leading-relaxed sm:text-xl">
                  {card.front}
                </p>
              </div>
              <div
                aria-hidden={!isFlipped}
                className="absolute inset-0 flex w-full items-center justify-center rounded-3xl border border-border-soft bg-primary-soft px-4 py-6 [backface-visibility:hidden] [transform:rotateY(180deg)] sm:px-8 sm:py-8"
              >
                <p className="max-h-[55vh] overflow-y-auto break-words whitespace-pre-wrap text-center text-lg font-semibold leading-relaxed sm:text-xl">
                  {card.back}
                </p>
              </div>
            </div>
          </div>
          <div className="absolute right-4 top-4 z-10">
            <CardCollectionsControl
              key={card.id}
              cardId={card.id}
              setId={card.setId}
              collections={collections}
              memberships={membershipsByCard[card.id] ?? []}
              variant="icon"
            />
          </div>
        </div>

        <Button
          type="button"
          variant="soft"
          className="size-12 shrink-0 rounded-full p-0"
          onClick={() => goNext()}
          disabled={isLast}
          aria-label="Thẻ tiếp theo"
        >
          <ChevronRight aria-hidden="true" className="size-6" />
        </Button>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button
          type="button"
          variant="soft"
          onClick={() => setIsFlipped((flipped) => !flipped)}
          aria-pressed={isFlipped}
        >
          {isFlipped ? "Nhấn để xem mặt trước" : "Nhấn để lật"}
        </Button>
        {isLast ? (
          <Button type="button" onClick={() => setIsCompleted(true)}>
            Hoàn thành
          </Button>
        ) : null}
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
