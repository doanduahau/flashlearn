"use client";

import { useState } from "react";

import type { AdminCatalogSetDetail } from "@/features/admin/server/admin-catalog-queries";

export interface CatalogPreviewTabProps {
  catalogSet: AdminCatalogSetDetail;
}

export function CatalogPreviewTab({ catalogSet }: CatalogPreviewTabProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const cards = catalogSet.cards;

  if (cards.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm text-slate-500">
          Bộ thẻ chưa có nội dung để xem trước. Vui lòng thêm thẻ ở tab Quản lý thẻ.
        </p>
      </div>
    );
  }

  const currentCard = cards[currentIndex];

  const handleNext = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev + 1) % cards.length);
  };

  const handlePrev = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev - 1 + cards.length) % cards.length);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-base font-semibold text-slate-900 dark:text-white">
            Xem trước trải nghiệm học Flashcard
          </h4>
          <p className="mt-0.5 text-xs text-slate-500">
            Mô phỏng giao diện người dùng thực tế khi học bộ thẻ này.
          </p>
        </div>
        <div className="text-xs font-medium text-slate-500">
          Thẻ {currentIndex + 1} / {cards.length}
        </div>
      </div>

      <div className="mt-8 flex flex-col items-center">
        <div
          onClick={() => setIsFlipped(!isFlipped)}
          className="flex min-h-[260px] w-full max-w-lg cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-emerald-100 bg-emerald-50/40 p-8 text-center shadow-sm transition hover:border-emerald-200 hover:shadow-md dark:border-emerald-950 dark:bg-emerald-950/20"
        >
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            {isFlipped ? "Mặt sau (Đáp án)" : "Mặt trước (Câu hỏi)"}
          </span>
          <p className="mt-4 whitespace-pre-wrap text-xl font-medium text-slate-800 dark:text-slate-100">
            {isFlipped ? currentCard.back : currentCard.front}
          </p>
          <span className="mt-6 text-xs text-slate-400">Nhấn vào thẻ để lật</span>
        </div>

        <div className="mt-6 flex items-center gap-4">
          <button
            type="button"
            onClick={handlePrev}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            ← Thẻ trước
          </button>
          <button
            type="button"
            onClick={() => setIsFlipped(!isFlipped)}
            className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Lật thẻ
          </button>
          <button
            type="button"
            onClick={handleNext}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Thẻ tiếp theo →
          </button>
        </div>
      </div>
    </div>
  );
}
