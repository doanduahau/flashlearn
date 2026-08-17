"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { BackButton } from "@/components/shared/back-button";
import { Button } from "@/components/ui/button";
import { SessionExitButton } from "@/features/learning-modes/components/session-exit-button";
import { MascotImage } from "@/features/mascot/components/mascot-image";
import type { MascotLevel } from "@/features/mascot/types/mascot-types";
import { CardCollectionsControl } from "@/features/special-collections/components/card-collections-control";
import { completeStudySession } from "@/features/study/server/actions";
import { studyModeHrefFromSession } from "@/features/study/utils/study-mode-href";
import type { StudyCard, StudyCollectionOption } from "@/features/study/types/study-types";
import { STUDY_MAX_CARDS } from "@/lib/constants";
import { cn } from "@/lib/utils";

const DRAG_THRESHOLD = 25;
const CLICK_SLOP = 8;
const CONTAINER_HEIGHT = 440;
const WHEEL_WINDOW = 5;
const INTERACTIVE_SELECTOR =
  'a, button, input, textarea, select, [role="button"], [contenteditable="true"]';

function getSignedDistance(index: number, current: number, total: number): number {
  if (total <= 1) return 0;
  let diff = index - current;
  const half = total / 2;
  if (diff > half) diff -= total;
  if (diff < -half) diff += total;
  return diff;
}

function getVisibleWindow(current: number, total: number, radius: number): number[] {
  if (total <= 0) return [];
  if (total <= 2 * radius + 1) {
    return Array.from({ length: total }, (_, i) => i);
  }
  const indices: number[] = [];
  for (let offset = -radius; offset <= radius; offset += 1) {
    indices.push((current + offset + total * (radius + 1)) % total);
  }
  return indices;
}

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
  const [completionError, setCompletionError] = useState<string | null>(null);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const completingRef = useRef(false);

  const dragRef = useRef<{ startY: number; startTime: number; active: boolean } | null>(null);
  const touchStartRef = useRef<{ y: number; time: number } | null>(null);
  const didDragRef = useRef(false);
  const lastWheelRef = useRef(0);
  const lastSwipeRef = useRef(0);

  const total = cards.length;
  const isLast = currentIndex === total - 1;
  const exitHref = studyModeHrefFromSession(sessionHref);

  const activeCard = cards[currentIndex] ?? cards[0];

  const goPrevious = useCallback(() => {
    setIsFlipped(false);
    setCurrentIndex((index) => (index - 1 + total) % total);
  }, [total]);

  const goNext = useCallback(() => {
    setIsFlipped(false);
    setCurrentIndex((index) => (index + 1) % total);
  }, [total]);

  const triggerMultiSwipe = useCallback(
    (direction: "next" | "prev", steps: number) => {
      if (steps <= 0) return;
      const now = Date.now();
      if (now - lastSwipeRef.current < steps * 130 + 100) return;
      lastSwipeRef.current = now;
      setIsFlipped(false);

      const stepDelay = 130;
      for (let i = 0; i < steps; i++) {
        setTimeout(() => {
          setCurrentIndex((index) => {
            const delta = direction === "next" ? 1 : -1;
            return (index + delta + total * 1000) % total;
          });
        }, i * stepDelay);
      }
    },
    [total],
  );

  function calculateSwipeStep(dyPx: number, dtMs: number): number {
    const absDy = Math.abs(dyPx);
    if (absDy < DRAG_THRESHOLD) return 0;
    const velocity = absDy / Math.max(1, dtMs); // px per ms

    if (velocity >= 1.5 || absDy >= 240) {
      return 3;
    }
    if (velocity >= 0.85 || absDy >= 120) {
      return 2;
    }
    return 1;
  }

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
      } else if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        event.preventDefault();
        goNext();
      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        event.preventDefault();
        goPrevious();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goNext, goPrevious, isCompleted]);

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
    setCompletionError(null);
    setCurrentIndex(0);
    setIsFlipped(false);
  }

  async function handleComplete(): Promise<void> {
    if (completingRef.current) return;
    completingRef.current = true;
    // Show the completion screen immediately; the daily-activity recording
    // runs in the background. Failures surface inline with a retry button.
    setCompletionError(null);
    setIsCompleted(true);
    try {
      const outcome = await completeStudySession();
      if (!outcome.ok) {
        setCompletionError(outcome.error);
      } else {
        router.refresh();
      }
    } finally {
      completingRef.current = false;
    }
  }

  function handleTouchStart(e: React.TouchEvent<HTMLDivElement>): void {
    const touch = e.touches[0];
    if (!touch) return;
    const target = e.target as HTMLElement | null;
    if (target && typeof target.closest === "function" && target.closest(INTERACTIVE_SELECTOR)) {
      touchStartRef.current = null;
      return;
    }
    touchStartRef.current = { y: touch.clientY, time: Date.now() };
    didDragRef.current = false;
    setIsDragging(true);
  }

  function handleTouchMove(e: React.TouchEvent<HTMLDivElement>): void {
    const start = touchStartRef.current;
    if (!start) return;
    const touch = e.touches[0];
    if (!touch) return;
    const dy = touch.clientY - start.y;
    if (Math.abs(dy) > CLICK_SLOP) {
      didDragRef.current = true;
    }
    setDragY(dy);
  }

  function handleTouchEnd(e: React.TouchEvent<HTMLDivElement>): void {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    setIsDragging(false);
    setDragY(0);
    if (!start) return;
    const touch = e.changedTouches[0];
    if (!touch) return;
    const dy = touch.clientY - start.y;
    const dt = Date.now() - start.time;
    const steps = calculateSwipeStep(dy, dt);
    if (steps > 0) {
      triggerMultiSwipe(dy < 0 ? "next" : "prev", steps);
    }
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>): void {
    if (event.pointerType === "touch") return;
    const target = event.target as HTMLElement | null;
    if (
      event.button !== 0 ||
      (target && typeof target.closest === "function" && target.closest(INTERACTIVE_SELECTOR))
    ) {
      dragRef.current = null;
      didDragRef.current = false;
      return;
    }
    dragRef.current = { startY: event.clientY, startTime: Date.now(), active: true };
    didDragRef.current = false;
    setIsDragging(true);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>): void {
    if (event.pointerType === "touch") return;
    const drag = dragRef.current;
    if (!drag?.active) return;
    const dy = event.clientY - drag.startY;
    if (Math.abs(dy) > CLICK_SLOP) {
      didDragRef.current = true;
    }
    setDragY(dy);
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>): void {
    if (event.pointerType === "touch") return;
    const drag = dragRef.current;
    dragRef.current = null;
    setIsDragging(false);
    setDragY(0);
    if (!drag?.active) return;
    const dy = event.clientY - drag.startY;
    const dt = Date.now() - drag.startTime;
    const steps = calculateSwipeStep(dy, dt);
    if (steps > 0) {
      triggerMultiSwipe(dy < 0 ? "next" : "prev", steps);
    }
  }

  function handleWheel(event: React.WheelEvent<HTMLDivElement>): void {
    const now = Date.now();
    if (now - lastWheelRef.current < 200) return;
    if (Math.abs(event.deltaY) > 15) {
      lastWheelRef.current = now;
      triggerMultiSwipe(event.deltaY > 0 ? "next" : "prev", 1);
    }
  }

  function handleActiveCardClick(): void {
    if (didDragRef.current) {
      didDragRef.current = false;
      return;
    }
    setIsFlipped((flipped) => !flipped);
  }

  const progress = ((currentIndex + 1) / total) * 100;

  if (isCompleted) {
    return (
      <main className="mx-auto flex h-dvh w-full max-w-3xl flex-col items-center justify-center gap-3 px-6 py-12 text-center">
        <MascotImage
          level={mascotLevel}
          state="congrats"
          size={144}
          className="size-36 object-contain"
          aria-hidden
        />
        <h2 className="text-xl font-bold sm:text-2xl">Hoàn thành!</h2>
        <p className="text-sm text-text-secondary">Đã xem {total} thẻ</p>
        {completionError ? (
          <div
            role="alert"
            className="flex flex-col gap-2 rounded-2xl border border-border-soft bg-surface p-4 text-left sm:flex-row sm:items-center sm:justify-between"
          >
            <p className="text-sm text-danger">{completionError}</p>
            <Button type="button" variant="outline" onClick={() => void handleComplete()}>
              Thử lại
            </Button>
          </div>
        ) : null}
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <Button type="button" variant="soft" onClick={handleReplay}>
            Chơi lại
          </Button>
          <BackButton fallbackHref={fallbackHref} />
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex h-dvh w-full max-w-3xl flex-col overflow-hidden px-4 py-3 sm:px-6 sm:py-4">
      <div className="flex items-center justify-between gap-3">
        <SessionExitButton fallbackHref={exitHref} />

        <div
          role="progressbar"
          aria-label="Tiến độ phiên học"
          aria-valuemin={1}
          aria-valuemax={total}
          aria-valuenow={currentIndex + 1}
          className="flex flex-1 items-center gap-3"
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
      </div>

      {/* Animated Flashcard Wheel Container */}
      <div
        className="relative my-2 flex w-full max-w-2xl flex-1 flex-col items-center justify-center overflow-hidden select-none [touch-action:none]"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
      >
        {getVisibleWindow(currentIndex, total, WHEEL_WINDOW).map((index) => {
          const c = cards[index]!;
          const diff = getSignedDistance(index, currentIndex, total);
          const isActive = diff === 0;

          const dragRatio = dragY / CONTAINER_HEIGHT;
          const effectiveDiff = diff + dragRatio;

          const translateY = diff * 76 + dragRatio * 100;
          const absEff = Math.abs(effectiveDiff);

          const scale = Math.max(0.9, 1 - Math.min(1, absEff) * 0.04);
          let opacity = 1 - Math.min(1, absEff) * 0.25;
          if (absEff > 1.5) {
            opacity = Math.max(0, 0.75 - (absEff - 1) * 0.75);
          }

          const zIndex = Math.max(0, Math.round(10 - absEff * 5));
          const pointerEvents: "auto" | "none" = absEff < 1.2 ? "auto" : "none";

          return (
            <div
              key={c.id}
              data-testid="study-card"
              data-active={isActive ? "true" : "false"}
              style={{
                transform: `translateY(${translateY}%) scale(${scale})`,
                opacity,
                zIndex,
                pointerEvents,
                willChange: isDragging || absEff < 1.2 ? "transform, opacity" : undefined,
              }}
              className={cn(
                "absolute top-1/2 left-0 -translate-y-1/2 w-full [contain:layout paint] motion-reduce:transition-none",
                isDragging
                  ? "transition-none"
                  : "transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]",
              )}
              onClick={() => {
                if (isActive) {
                  handleActiveCardClick();
                } else if (diff === -1) {
                  goPrevious();
                } else if (diff === 1) {
                  goNext();
                }
              }}
            >
              <div className={cn("select-none", isActive && "[perspective:1200px]")}>
                <div
                  className={cn(
                    "relative transition-transform duration-200 ease-out [transform-style:preserve-3d] motion-reduce:transition-none",
                    isActive && isFlipped && "[transform:rotateY(180deg)]",
                  )}
                >
                  {/* Front */}
                  <div
                    aria-hidden={isActive && isFlipped}
                    className={cn(
                      "relative flex min-h-72 w-full items-center justify-center rounded-3xl bg-surface px-4 py-6 [backface-visibility:hidden] [-webkit-backface-visibility:hidden] sm:px-8 sm:py-8",
                      isActive
                        ? "border-2 border-primary shadow-lg ring-4 ring-primary/15"
                        : "border border-border-soft/80 shadow-md",
                    )}
                  >
                    <p
                      className={cn(
                        "break-words whitespace-pre-wrap text-center font-semibold leading-relaxed",
                        isActive
                          ? "max-h-[50vh] overflow-y-auto text-lg sm:text-xl"
                          : "line-clamp-2 text-base font-bold text-text-primary opacity-80 sm:text-lg",
                      )}
                    >
                      {c.front}
                    </p>
                    {isActive && !isFlipped ? (
                      <div className="absolute right-4 top-4 z-20">
                        <CardCollectionsControl
                          key={c.id}
                          cardId={c.id}
                          setId={c.setId}
                          collections={collections}
                          memberships={membershipsByCard[c.id] ?? []}
                          variant="icon"
                        />
                      </div>
                    ) : null}
                  </div>

                  {/* Back */}
                  <div
                    aria-hidden={!isActive || !isFlipped}
                    className={cn(
                      "absolute inset-0 flex w-full items-center justify-center rounded-3xl bg-primary-soft px-4 py-6 [backface-visibility:hidden] [-webkit-backface-visibility:hidden] [transform:rotateY(180deg)] sm:px-8 sm:py-8",
                      isActive
                        ? "border-2 border-primary shadow-lg ring-4 ring-primary/15"
                        : "border border-border-soft/80 shadow-md",
                    )}
                  >
                    <p className="max-h-[50vh] overflow-y-auto break-words whitespace-pre-wrap text-center text-lg font-semibold leading-relaxed sm:text-xl">
                      {c.back}
                    </p>
                    {isActive && isFlipped ? (
                      <div className="absolute right-4 top-4 z-20">
                        <CardCollectionsControl
                          key={c.id}
                          cardId={c.id}
                          setId={c.setId}
                          collections={collections}
                          memberships={membershipsByCard[c.id] ?? []}
                          variant="icon"
                        />
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex min-h-10 items-center justify-center">
        {isLast ? (
          <Button type="button" onClick={() => void handleComplete()}>
            Hoàn thành
          </Button>
        ) : (
          <p className="text-xs text-text-secondary">Chạm vào thẻ để lật</p>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border-soft/70 pt-2">
        <div className="min-w-0">
          <p className="text-xs text-text-secondary">Bộ gốc</p>
          <p className="truncate text-sm font-semibold">{activeCard.setName}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
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
        <p className="mt-1 text-center text-xs text-text-secondary">
          Phiên giới hạn ở {STUDY_MAX_CARDS} thẻ. Hãy chọn phạm vi nhỏ hơn để ôn toàn bộ.
        </p>
      ) : null}
    </main>
  );
}
