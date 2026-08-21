"use client";

import { useState } from "react";

import { CatalogActionDialog } from "@/features/admin/components/catalog/catalog-action-dialog";
import { replaceCatalogCardsAction } from "@/features/admin/server/admin-catalog-actions";
import type { AdminCatalogSetDetail } from "@/features/admin/server/admin-catalog-queries";

export interface CatalogCardEditorProps {
  catalogSet: AdminCatalogSetDetail;
  mutationsEnabled: boolean;
}

interface EditableCard {
  id?: string;
  front: string;
  back: string;
}

export function CatalogCardEditor({ catalogSet, mutationsEnabled }: CatalogCardEditorProps) {
  const [cards, setCards] = useState<EditableCard[]>(
    catalogSet.cards.map((c) => ({ id: c.id, front: c.front, back: c.back })),
  );
  const [updatedAt, setUpdatedAt] = useState(catalogSet.updatedAt);
  const [isReasonDialogOpen, setIsReasonDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const isDraft = catalogSet.status === "draft";
  const isReadOnly = !isDraft || !mutationsEnabled || catalogSet.exceedsEditorCap;

  const handleAddCard = () => {
    if (cards.length >= 2000) return;
    setCards([...cards, { front: "", back: "" }]);
  };

  const handleRemoveCard = (index: number) => {
    setCards(cards.filter((_, i) => i !== index));
  };

  const handleCardChange = (index: number, field: "front" | "back", value: string) => {
    const updated = [...cards];
    updated[index][field] = value;
    setCards(updated);
  };

  const handleMoveCard = (index: number, direction: "up" | "down") => {
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === cards.length - 1) return;
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    const updated = [...cards];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    setCards(updated);
  };

  const handleSaveConfirmed = async (reason: string) => {
    setError(null);
    setSuccessMsg(null);

    // Filter out empty cards or trim them
    const payloadCards = cards.map((c) => ({
      front: c.front.trim(),
      back: c.back.trim(),
    }));

    // Check for empty front/back in non-empty array
    for (let i = 0; i < payloadCards.length; i++) {
      if (!payloadCards[i].front || !payloadCards[i].back) {
        return {
          success: false,
          message: `Thẻ số ${i + 1} chưa điền đầy đủ cả Mặt trước và Mặt sau.`,
        };
      }
    }

    const result = await replaceCatalogCardsAction({
      catalog_set_id: catalogSet.id,
      expected_updated_at: updatedAt,
      cards: payloadCards,
      reason,
    });

    if (result.success) {
      setSuccessMsg(`Lưu thành công ${result.data.cardCount} thẻ.`);
      setUpdatedAt(result.data.updatedAt);
      return { success: true };
    } else {
      setError(result.message);
      return { success: false, message: result.message };
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h4 className="text-base font-semibold text-slate-900 dark:text-white">
            Danh sách Thẻ trong bộ ({cards.length} thẻ)
          </h4>
          <p className="mt-1 text-xs text-slate-500">
            {isDraft
              ? "Bản thảo cho phép lưu 0 thẻ. Khi Xuất bản (Publish) bắt buộc có ít nhất 1 thẻ."
              : "Bộ thẻ đang phát hành/lưu trữ. Vui lòng Gỡ xuất bản về Bản thảo để chỉnh sửa thẻ."}
          </p>
        </div>

        {isDraft && mutationsEnabled && !catalogSet.exceedsEditorCap && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleAddCard}
              disabled={cards.length >= 2000}
              className="rounded-xl border border-slate-300 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 disabled:opacity-50"
            >
              + Thêm thẻ
            </button>
            <button
              type="button"
              onClick={() => setIsReasonDialogOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-medium text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
            >
              Lưu danh sách thẻ
            </button>
          </div>
        )}
      </div>

      {catalogSet.exceedsEditorCap && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
          <div className="font-semibold">Cảnh báo giới hạn trình biên tập:</div>
          <div>
            Bộ thẻ này có tổng cộng {catalogSet.cardCount} thẻ (vượt ngưỡng an toàn 2,000 thẻ của
            trình biên tập web). Chế độ chỉnh sửa hàng loạt bị khóa để chống mất mát dữ liệu do tải
            không đầy đủ.
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-400">
          <div className="font-semibold">Không thể lưu danh sách thẻ:</div>
          <div>{error}</div>
          {error.includes("P0004") || error.includes("làm mới") ? (
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-2 text-xs font-semibold underline"
            >
              Tải lại trang ngay
            </button>
          ) : null}
        </div>
      )}

      {successMsg && (
        <div className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
          {successMsg}
        </div>
      )}

      <div className="mt-6 space-y-3">
        {cards.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400 dark:border-slate-800">
            Chưa có thẻ nào trong bản thảo này. Nhấn &quot;+ Thêm thẻ&quot; để bắt đầu.
          </div>
        ) : (
          cards.map((card, idx) => (
            <div
              key={idx}
              className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-800/30"
            >
              <div className="flex flex-col items-center gap-1 pt-2 text-xs font-semibold text-slate-400">
                <span>#{idx + 1}</span>
                {!isReadOnly && (
                  <div className="flex flex-col gap-0.5">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMoveCard(idx, "up")}
                      className="rounded p-0.5 text-slate-400 hover:bg-slate-200 disabled:opacity-20 dark:hover:bg-slate-700"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      disabled={idx === cards.length - 1}
                      onClick={() => handleMoveCard(idx, "down")}
                      className="rounded p-0.5 text-slate-400 hover:bg-slate-200 disabled:opacity-20 dark:hover:bg-slate-700"
                    >
                      ▼
                    </button>
                  </div>
                )}
              </div>

              <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-[10px] font-medium uppercase tracking-wider text-slate-500">
                    Mặt trước (Câu hỏi / Từ vựng)
                  </label>
                  <textarea
                    rows={2}
                    disabled={isReadOnly}
                    value={card.front}
                    onChange={(e) => handleCardChange(idx, "front", e.target.value)}
                    placeholder="Nhập mặt trước..."
                    className="mt-1 block w-full rounded-lg border border-slate-300 p-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:disabled:bg-slate-800/50"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium uppercase tracking-wider text-slate-500">
                    Mặt sau (Đáp án / Nghĩa)
                  </label>
                  <textarea
                    rows={2}
                    disabled={isReadOnly}
                    value={card.back}
                    onChange={(e) => handleCardChange(idx, "back", e.target.value)}
                    placeholder="Nhập mặt sau..."
                    className="mt-1 block w-full rounded-lg border border-slate-300 p-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:disabled:bg-slate-800/50"
                  />
                </div>
              </div>

              {!isReadOnly && (
                <button
                  type="button"
                  onClick={() => handleRemoveCard(idx)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50"
                  title="Xóa thẻ"
                >
                  ✕
                </button>
              )}
            </div>
          ))
        )}
      </div>

      <CatalogActionDialog
        isOpen={isReasonDialogOpen}
        onClose={() => setIsReasonDialogOpen(false)}
        title="Xác nhận lưu danh sách Thẻ"
        description={`Bạn sắp lưu ${cards.length} thẻ vào bản thảo. Vui lòng nhập lý do thay đổi để ghi nhận vào nhật ký kiểm toán.`}
        actionLabel="Xác nhận & Lưu"
        actionVariant="primary"
        onConfirm={handleSaveConfirmed}
      />
    </div>
  );
}
