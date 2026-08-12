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
import { cn } from "@/lib/utils";

type MatchBoardProps = {
  batches: MatchBatch[];
  questionCount: number;
  onComplete: () => void;
};

export function MatchBoard({ batches, questionCount, onComplete }: MatchBoardProps) {
  const [state, setState] = useState<MatchState>(() => createMatchState(batches));
  const completionNotifiedRef = useRef(false);

  const phase = phaseOf(state);

  useEffect(() => {
    if (phase === "completed" && !completionNotifiedRef.current) {
      completionNotifiedRef.current = true;
      onComplete();
    }
  }, [phase, onComplete]);

  if (phase === "completed") {
    return null;
  }

  const batch = currentBatch(state);
  const completed = completedCount(state);

  function handleSelect(side: "front" | "back", card: MatchCard): void {
    if (side === "front" && state.matchedFrontIds.has(card.id)) return;
    if (side === "back" && state.matchedBackIds.has(card.id)) return;
    setState((prev) => selectCard(prev, side, card.id));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-text-secondary">
          Bộ {state.currentBatchIndex + 1} / {batches.length}
        </p>
        <p className="text-sm font-medium">
          Đã nối {completed} / {questionCount}
        </p>
      </div>
      {state.lastResult === "incorrect" ? (
        <p role="alert" aria-live="polite" className="text-sm text-danger">
          Chưa đúng, thử cặp khác.
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
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
    <ul className="flex flex-col gap-2" aria-label={side === "front" ? "Mặt trước" : "Mặt sau"}>
      {cards.map((card) => {
        const matched = matchedIds.has(card.id);
        const selected = selectedId === card.id;
        return (
          <li key={card.id}>
            <button
              type="button"
              disabled={matched}
              aria-pressed={selected}
              data-match-card-id={card.id}
              data-match-side={side}
              onClick={() => onSelect(side, card)}
              className={cn(
                "w-full break-words whitespace-pre-wrap rounded-xl border px-3 py-2 text-left text-sm leading-snug transition-colors sm:rounded-2xl sm:px-4 sm:py-3 sm:text-base",
                matched
                  ? "cursor-default border-border-soft bg-surface-subtle opacity-50"
                  : selected
                    ? "border-primary bg-primary-soft text-primary-foreground"
                    : "border-border-soft bg-surface hover:bg-surface-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary",
              )}
            >
              {side === "front" ? card.front : card.back}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
