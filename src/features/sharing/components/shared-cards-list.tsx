"use client";

import { useState } from "react";

const CARDS_PER_PAGE = 50;

const controlClassName =
  "inline-flex h-10 items-center justify-center rounded-xl border border-border-soft bg-surface px-4 text-sm font-medium";
const enabledControlClassName = `${controlClassName} hover:bg-surface-subtle`;
const disabledControlClassName = `${controlClassName} cursor-not-allowed opacity-50`;

export function SharedCardsList({
  cards,
}: Readonly<{ cards: { id: string; front: string; back: string }[] }>) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(cards.length / CARDS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const from = (currentPage - 1) * CARDS_PER_PAGE;
  const visibleCards = cards.slice(from, from + CARDS_PER_PAGE);
  const hasPrevious = currentPage > 1;
  const hasNext = currentPage < totalPages;

  return (
    <>
      <ol className="mt-4 grid gap-3">
        {visibleCards.map((card) => (
          <li key={card.id} className="rounded-2xl border border-border-soft bg-surface p-4 sm:p-5">
            <p className="font-medium text-text-primary">{card.front}</p>
            <p className="mt-1 text-text-secondary">{card.back}</p>
          </li>
        ))}
      </ol>
      {totalPages > 1 ? (
        <nav aria-label="Phân trang" className="mt-6 flex items-center justify-center gap-3">
          {hasPrevious ? (
            <button
              type="button"
              className={enabledControlClassName}
              onClick={() => setPage(currentPage - 1)}
            >
              Trước
            </button>
          ) : (
            <span className={disabledControlClassName} aria-disabled="true">
              Trước
            </span>
          )}
          <span className="text-sm text-text-secondary">
            Trang {currentPage} / {totalPages}
          </span>
          {hasNext ? (
            <button
              type="button"
              className={enabledControlClassName}
              onClick={() => setPage(currentPage + 1)}
            >
              Sau
            </button>
          ) : (
            <span className={disabledControlClassName} aria-disabled="true">
              Sau
            </span>
          )}
        </nav>
      ) : null}
    </>
  );
}
