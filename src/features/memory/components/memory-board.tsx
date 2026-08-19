"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";

import type { MemoryBatch, MemoryTile } from "@/features/memory/types/memory-types";
import {
  CELEBRATION_DELAY_MS,
  CORRECT_REVIEW_DELAY_MS,
  createMemoryState,
  currentBatch,
  isFinalPendingPair,
  isTileFlipped,
  isTileMatched,
  MISMATCH_DELAY_MS,
  previewTile,
  resolveCelebration,
  resolveCorrectPair,
  resolveMismatch,
  tapTile,
  type MemoryState,
} from "@/features/memory/utils/memory-state";
import {
  DEFAULT_MEMORY_GRID_LAYOUT,
  computeMemoryGridLayout,
  type MemoryGridLayout,
} from "@/features/memory/utils/memory-grid-layout";
import { cn } from "@/lib/utils";

type MemoryBoardProps = {
  batches: MemoryBatch[];
  questionCount: number;
  isPaused?: boolean;
  onComplete: (elapsedMs: number) => Promise<void>;
};

// Hard floor so tiles can never collapse to near-zero height even if the
// viewport measurement is delayed or fails.
const MEMORY_GRID_MIN_HEIGHT_PX = 240;
// Breathing room below the grid (session pages render full-screen with no
// bottom navigation, so only a small margin is needed).
const MEMORY_GRID_BOTTOM_RESERVE_PX = 24;

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function MemoryBoard({ batches, questionCount, isPaused, onComplete }: MemoryBoardProps) {
  const [state, setState] = useState<MemoryState>(() => createMemoryState(batches));
  const [elapsedMs, setElapsedMs] = useState(0);
  const lastTickRef = useRef(() => Date.now());
  const completedRef = useRef(false);
  const finalElapsedRef = useRef<number | null>(null);

  const boardRootRef = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<HTMLUListElement | null>(null);
  const [gridWidth, setGridWidth] = useState<number | null>(null);
  const [gridHeightPx, setGridHeightPx] = useState(MEMORY_GRID_MIN_HEIGHT_PX);

  useEffect(() => {
    lastTickRef.current = Date.now;
    let lastTick = lastTickRef.current();
    const interval = setInterval(() => {
      const now = Date.now();
      const delta = now - lastTick;
      lastTick = now;
      if (!completedRef.current && !isPaused) {
        setElapsedMs((prev) => prev + delta);
      }
    }, 250);
    return () => clearInterval(interval);
  }, [isPaused]);

  useEffect(() => {
    const grid = gridRef.current;
    const boardRoot = boardRootRef.current;
    if (!grid || !boardRoot || typeof ResizeObserver === "undefined") return;

    const updateGridHeight = () => {
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      const top = grid.getBoundingClientRect().top;
      const available = Math.floor(viewportHeight - top - MEMORY_GRID_BOTTOM_RESERVE_PX);
      setGridHeightPx(Math.max(MEMORY_GRID_MIN_HEIGHT_PX, available));
    };

    const gridObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setGridWidth(entry.contentRect.width);
    });
    gridObserver.observe(grid);

    const boardObserver = new ResizeObserver(updateGridHeight);
    boardObserver.observe(boardRoot);

    window.addEventListener("resize", updateGridHeight);
    window.addEventListener("orientationchange", updateGridHeight);

    return () => {
      gridObserver.disconnect();
      boardObserver.disconnect();
      window.removeEventListener("resize", updateGridHeight);
      window.removeEventListener("orientationchange", updateGridHeight);
    };
  }, []);

  const gridLayout: MemoryGridLayout = useMemo(
    () =>
      gridWidth !== null
        ? computeMemoryGridLayout(gridWidth, gridHeightPx)
        : DEFAULT_MEMORY_GRID_LAYOUT,
    [gridWidth, gridHeightPx],
  );

  useEffect(() => {
    if (state.phase === "mismatch") {
      const timer = setTimeout(() => setState(resolveMismatch), MISMATCH_DELAY_MS);
      return () => clearTimeout(timer);
    }
    if (state.phase === "correct-pending") {
      const timer = setTimeout(() => setState(resolveCorrectPair), CORRECT_REVIEW_DELAY_MS);
      return () => clearTimeout(timer);
    }
    if (state.phase === "celebration") {
      const timer = setTimeout(() => setState(resolveCelebration), CELEBRATION_DELAY_MS);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [state.phase]);

  useEffect(() => {
    if (state.phase === "completed" && finalElapsedRef.current !== null) {
      void onComplete(finalElapsedRef.current);
    }
  }, [state.phase, onComplete]);

  const batch = currentBatch(state);
  const preview = previewTile(state);
  const completed = state.completedCount;

  function handleTap(tile: MemoryTile): void {
    if (state.matchedKeys.has(tile.key)) return;
    const next = tapTile(state, tile.key);
    setState(next);

    // Freeze the session timer at the logical match moment of the final pair,
    // before its one-second review delay and the celebration run.
    if (isFinalPendingPair(next) && !completedRef.current) {
      completedRef.current = true;
      finalElapsedRef.current = elapsedMs;
    }
  }

  return (
    <div ref={boardRootRef} className="flex min-h-0 flex-col gap-3 sm:gap-4">
      <div className="flex shrink-0 items-center justify-between gap-2">
        <p className="text-sm text-text-secondary">
          Bộ {state.currentBatchIndex + 1} / {batches.length}
        </p>
        <p className="text-sm font-medium tabular-nums">{formatTime(elapsedMs)}</p>
        <p className="text-sm font-medium">
          {completed} / {questionCount}
        </p>
      </div>

      <div
        aria-live="polite"
        className={cn(
          "max-h-44 min-h-16 shrink-0 overflow-y-auto overscroll-contain rounded-xl border p-3 text-sm sm:max-h-52 sm:rounded-2xl sm:p-4 sm:text-base",
          state.phase === "mismatch" ? "border-danger" : "border-border-soft",
        )}
        data-testid="memory-preview"
      >
        <div className="relative min-h-16">
          {preview ? (
            <p
              data-testid="memory-preview-content"
              className="whitespace-pre-wrap break-words leading-relaxed"
            >
              {preview.content}
            </p>
          ) : (
            <p className="text-text-secondary">Chạm vào một ô để xem nội dung.</p>
          )}
          {state.phase === "celebration" ? <Confetti /> : null}
        </div>
      </div>

      <ul
        ref={gridRef}
        className="grid shrink-0 gap-2 sm:gap-3"
        role="group"
        aria-label="Lưới Memory"
        style={{
          height: `${gridHeightPx}px`,
          minHeight: `${gridHeightPx}px`,
          gridTemplateColumns: `repeat(${gridLayout.columns}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${gridLayout.rows}, minmax(0, 1fr))`,
        }}
      >
        {batch.tiles.map((tile) => (
          <MemoryTileButton
            key={tile.key}
            tile={tile}
            matched={isTileMatched(state, tile.key)}
            flipped={isTileFlipped(state, tile.key)}
            disabled={state.matchedKeys.has(tile.key) || isPaused === true}
            onTap={() => {
              if (isPaused) return;
              handleTap(tile);
            }}
          />
        ))}
      </ul>

      <span className="sr-only" aria-live="assertive">
        {state.phase === "mismatch"
          ? "Không khớp"
          : state.phase === "celebration" || state.phase === "correct-pending"
            ? "Ghép đúng"
            : ""}
      </span>
    </div>
  );
}

function MemoryTileButton({
  tile,
  matched,
  flipped,
  disabled,
  onTap,
}: Readonly<{
  tile: MemoryTile;
  matched: boolean;
  flipped: boolean;
  disabled: boolean;
  onTap: () => void;
}>) {
  const revealed = matched || flipped;
  return (
    <li className="h-full w-full min-h-0 min-w-0 [perspective:600px]">
      <button
        type="button"
        disabled={disabled}
        aria-pressed={revealed}
        data-testid={tile.key}
        data-memory-tile-key={tile.key}
        data-memory-card-id={tile.cardId}
        data-memory-side={tile.side}
        aria-label={matched ? "Đã ghép đúng" : flipped ? "Đã lật" : "Ô úp"}
        onClick={onTap}
        className={cn(
          "relative h-full w-full [transform-style:preserve-3d] transition-transform duration-300 motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary",
          revealed && "[transform:rotateY(180deg)]",
          matched && "opacity-50",
        )}
      >
        <span
          aria-hidden="true"
          className="absolute inset-0 h-full w-full rounded-xl border-2 border-border-soft bg-info/20 [backface-visibility:hidden] hover:bg-info/30 sm:rounded-2xl"
        />
        <span
          aria-hidden="true"
          className="absolute inset-0 flex h-full w-full items-center justify-center rounded-xl border-2 border-primary bg-primary-soft [backface-visibility:hidden] [transform:rotateY(180deg)] sm:rounded-2xl"
        >
          <Image
            src="/mascot/logo.png"
            alt=""
            aria-hidden="true"
            className="h-4/5 w-4/5 object-contain"
            width={96}
            height={96}
          />
        </span>
      </button>
    </li>
  );
}

function Confetti() {
  const pieces = Array.from({ length: 10 }, (_, index) => index);
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((piece) => (
        <span
          key={piece}
          className="confetti-piece absolute top-1/2 h-1.5 w-1.5 rounded-full motion-safe:animate-confetti"
          style={{
            left: `${(piece * 10 + 5) % 100}%`,
            backgroundColor: ["#fdc07f", "#f6c85f", "#7ab8e8", "#ef8585"][piece % 4],
          }}
        />
      ))}
    </span>
  );
}
