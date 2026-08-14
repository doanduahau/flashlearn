"use client";

import { useEffect, useRef, useState } from "react";

import type { MatchBatch, MatchCard } from "@/features/match/types/match-types";
import {
  completedCount,
  createMatchState,
  currentBatch,
  phaseOf,
  selectCard,
  type MatchState,
} from "@/features/match/utils/match-state";
import { getMatchLabelTextSize } from "@/features/match/utils/match-label-size";
import { cn } from "@/lib/utils";

type MatchBoardProps = {
  batches: MatchBatch[];
  questionCount: number;
  isPaused?: boolean;
  onComplete: () => Promise<void>;
};

export function MatchBoard({ batches, questionCount, isPaused, onComplete }: MatchBoardProps) {
  const [state, setState] = useState<MatchState>(() => createMatchState(batches));
  const completionNotifiedRef = useRef(false);

  const phase = phaseOf(state);

  useEffect(() => {
    if (phase === "completed" && !completionNotifiedRef.current) {
      completionNotifiedRef.current = true;
      void onComplete();
    }
  }, [phase, onComplete, batches]);

  if (phase === "completed") {
    return null;
  }

  const batch = currentBatch(state);
  const completed = completedCount(state);

  function handleSelect(side: "front" | "back", card: MatchCard): void {
    if (isPaused) return;
    if (side === "front" && state.matchedFrontIds.has(card.id)) return;
    if (side === "back" && state.matchedBackIds.has(card.id)) return;
    setState((prev) => selectCard(prev, side, card.id));
  }

  return (
    <div className="flex h-[calc(100dvh-140px)] flex-col gap-4 sm:h-[calc(100dvh-160px)]">
      <div className="flex shrink-0 items-center justify-between gap-2">
        <p className="text-sm text-text-secondary">
          Bộ {state.currentBatchIndex + 1} / {batches.length}
        </p>
        <p className="text-sm font-medium">
          Đã nối {completed} / {questionCount}
        </p>
      </div>
      {state.lastResult === "incorrect" ? (
        <p role="alert" aria-live="polite" className="shrink-0 text-sm text-danger">
          Chưa đúng, thử cặp khác.
        </p>
      ) : null}
      <div className="grid min-h-0 min-w-0 flex-1 grid-cols-2 gap-2 sm:gap-3">
        <MatchColumn
          side="front"
          cards={batch.fronts}
          matchedIds={state.matchedFrontIds}
          selectedId={state.selectedFrontId}
          onSelect={handleSelect}
        />
        <MatchColumn
          side="back"
          cards={batch.backs}
          matchedIds={state.matchedBackIds}
          selectedId={state.selectedBackId}
          onSelect={handleSelect}
        />
      </div>
    </div>
  );
}

function MatchColumn({
  side,
  cards,
  matchedIds,
  selectedId,
  onSelect,
}: Readonly<{
  side: "front" | "back";
  cards: MatchCard[];
  matchedIds: Set<string>;
  selectedId: string | null;
  onSelect: (side: "front" | "back", card: MatchCard) => void;
}>) {
  return (
    <ul
      className="grid h-full min-h-0 min-w-0 grid-rows-6 gap-2 sm:gap-3"
      aria-label={side === "front" ? "Mặt trước" : "Mặt sau"}
    >
      {cards.map((card) => {
        const matched = matchedIds.has(card.id);
        const selected = selectedId === card.id;
        const text = side === "front" ? card.front : card.back;
        const textClass = getMatchLabelTextSize(text);

        return (
          <li key={card.id} className="min-h-0 min-w-0">
            <button
              type="button"
              disabled={matched}
              aria-pressed={selected}
              data-match-card-id={card.id}
              data-match-side={side}
              onClick={() => onSelect(side, card)}
              className={cn(
                "flex h-full w-full items-center justify-center overflow-hidden break-words whitespace-pre-wrap rounded-xl border p-2 text-center transition-colors sm:rounded-2xl sm:p-3",
                textClass,
                matched
                  ? "cursor-default border-border-soft bg-surface-subtle opacity-50"
                  : selected
                    ? "border-primary bg-primary-soft text-primary-foreground"
                    : "border-border-soft bg-surface hover:bg-surface-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary",
              )}
            >
              <span className="line-clamp-6">{text}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
