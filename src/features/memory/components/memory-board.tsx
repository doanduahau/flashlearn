"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";

import type { MemoryBatch, MemoryTile } from "@/features/memory/types/memory-types";
import {
  CELEBRATION_DELAY_MS,
  createMemoryState,
  currentBatch,
  isTileFlipped,
  isTileMatched,
  MISMATCH_DELAY_MS,
  previewTile,
  resolveCelebration,
  resolveMismatch,
  tapTile,
  type MemoryState,
} from "@/features/memory/utils/memory-state";
import { cn } from "@/lib/utils";

type MemoryBoardProps = {
  batches: MemoryBatch[];
  questionCount: number;
  onComplete: (elapsedMs: number) => Promise<void>;
};

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function MemoryBoard({ batches, questionCount, onComplete }: MemoryBoardProps) {
  const [state, setState] = useState<MemoryState>(() => createMemoryState(batches));
  const [elapsedMs, setElapsedMs] = useState(0);
  const [startTime] = useState(() => Date.now());
  const completedRef = useRef(false);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!completedRef.current) setElapsedMs(Date.now() - startTime);
    }, 250);
    return () => clearInterval(interval);
  }, [startTime]);

  useEffect(() => {
    if (state.phase === "mismatch") {
      const timer = setTimeout(() => setState(resolveMismatch), MISMATCH_DELAY_MS);
      return () => clearTimeout(timer);
    }
    if (state.phase === "celebration") {
      const timer = setTimeout(() => setState(resolveCelebration), CELEBRATION_DELAY_MS);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [state.phase]);

  useEffect(() => {
    if (state.phase === "completed" && !completedRef.current) {
      completedRef.current = true;
      const finalElapsed = Date.now() - startTime;
      setElapsedMs(finalElapsed);
      void onComplete(finalElapsed);
    }
  }, [state.phase, onComplete, startTime]);

  const batch = currentBatch(state);
  const preview = previewTile(state);
  const completed = state.completedCount;

  function handleTap(tile: MemoryTile): void {
    if (state.matchedKeys.has(tile.key)) return;
    setState((prev) => tapTile(prev, tile.key));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
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
          "max-h-44 overflow-y-auto overscroll-contain rounded-xl border p-3 text-sm sm:max-h-52 sm:rounded-2xl sm:p-4 sm:text-base",
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

      <ul className="grid grid-cols-3 gap-2 sm:gap-3" role="group" aria-label="Lưới Memory">
        {batch.tiles.map((tile) => (
          <MemoryTileButton
            key={tile.key}
            tile={tile}
            matched={isTileMatched(state, tile.key)}
            flipped={isTileFlipped(state, tile.key)}
            disabled={state.matchedKeys.has(tile.key)}
            onTap={() => handleTap(tile)}
          />
        ))}
      </ul>

      <span className="sr-only" aria-live="assertive">
        {state.phase === "mismatch"
          ? "Không khớp"
          : state.phase === "celebration"
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
    <li>
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
          "flex aspect-square w-full items-center justify-center rounded-xl border transition-colors sm:rounded-2xl",
          matched
            ? "border-border-soft bg-surface-subtle opacity-50"
            : flipped
              ? "border-primary bg-primary-soft"
              : "border-border-soft bg-info/20 hover:bg-info/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary",
        )}
      >
        {revealed ? <ArrowUp aria-hidden="true" className="size-5 sm:size-6" /> : null}
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
            backgroundColor: ["#7bcfa6", "#f6c85f", "#7ab8e8", "#ef8585"][piece % 4],
          }}
        />
      ))}
    </span>
  );
}
