"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { TrashIcon } from "lucide-react";

import { MascotImage } from "@/features/mascot/components/mascot-image";
import type { MascotLevel } from "@/features/mascot/types/mascot-types";
import { importFlashcards } from "@/features/imports/server/actions";
import type { DraftFlashcard } from "@/features/imports/types/import-types";
import { validateDraftCards } from "@/features/imports/utils/validate-draft-cards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IMPORT_MAX_ROWS, IMPORT_PREVIEW_ROWS, SET_NAME_MAX_LENGTH } from "@/lib/constants";

export type CreateSummaryMetadata = {
  label?: string;
  value?: string;
};

type Props = {
  sourceCards: DraftFlashcard[];
  sourceMetadata?: CreateSummaryMetadata[];
  warnings?: string[];
  limitExceeded?: boolean;
  mascotLevel: MascotLevel;
  children?: React.ReactNode;
};

export function CreateSummary({
  sourceCards,
  sourceMetadata,
  warnings,
  limitExceeded,
  mascotLevel,
  children,
}: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const importInFlightRef = useRef(false);

  const [editableCards, setEditableCards] = useState<DraftFlashcard[]>(sourceCards);
  const [prevSourceCards, setPrevSourceCards] = useState<DraftFlashcard[]>(sourceCards);

  if (sourceCards !== prevSourceCards) {
    setPrevSourceCards(sourceCards);
    setEditableCards(sourceCards);
  }

  const validation = useMemo(() => {
    try {
      return validateDraftCards(editableCards);
    } catch {
      return null;
    }
  }, [editableCards]);

  const overLimit = limitExceeded === true || validation === null;
  const hasValidCards = validation !== null && validation.valid > 0;
  const canCreate = !overLimit && hasValidCards && name.trim().length > 0 && !importing;

  async function handleCreate(): Promise<void> {
    if (!canCreate || validation === null || importInFlightRef.current) return;
    importInFlightRef.current = true;
    setError("");
    setImporting(true);
    try {
      const result = await importFlashcards({ name, cards: validation.cards });
      if ("error" in result) {
        setError(result.error);
      } else {
        router.push(`/sets/${result.setId}`);
      }
    } catch {
      setError("Không thể tạo bộ. Vui lòng thử lại.");
    } finally {
      importInFlightRef.current = false;
      setImporting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {sourceMetadata && sourceMetadata.length > 0 && (
        <div className="flex flex-col text-sm">
          {sourceMetadata.map((meta, i) => (
            <div key={i} className="flex gap-2">
              {meta.label && <span className="text-text-secondary">{meta.label}:</span>}
              <span className="font-medium">{meta.value}</span>
            </div>
          ))}
        </div>
      )}

      {overLimit ? (
        <div className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
          Tài liệu tạo ra quá nhiều thẻ. CapyStudy hỗ trợ tối đa{" "}
          {IMPORT_MAX_ROWS.toLocaleString("vi-VN")} thẻ mỗi lần import. Hãy chia tài liệu thành phần
          nhỏ hơn.
        </div>
      ) : null}

      {warnings && warnings.length > 0 && !overLimit && (
        <div className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm">
          <p className="font-medium">Lưu ý:</p>
          <ul className="list-inside list-disc">
            {warnings.map((warning, i) => (
              <li key={i}>{warning}</li>
            ))}
          </ul>
          {hasValidCards && <p className="mt-1">Bạn vẫn có thể tạo bộ từ các thẻ hiện có.</p>}
        </div>
      )}

      {!overLimit && !hasValidCards && (
        <div
          className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger"
          role="alert"
        >
          Không có thẻ hợp lệ nào để tạo bộ. Kiểm tra lại nội dung nguồn.
        </div>
      )}

      {hasValidCards && (
        <div className="rounded-xl border border-border-soft bg-surface-subtle p-3 text-sm sm:p-4">
          <p className="font-semibold">{validation.valid.toLocaleString("vi-VN")} thẻ hợp lệ</p>
          {validation.blank > 0 && (
            <p className="mt-1 text-text-secondary">
              {validation.blank.toLocaleString("vi-VN")} dòng trống được bỏ qua.
            </p>
          )}
          {validation.partial > 0 && (
            <p className="mt-1 text-text-secondary">
              {validation.partial.toLocaleString("vi-VN")} thẻ thiếu mặt trước hoặc mặt sau được bỏ
              qua.
            </p>
          )}
          {validation.duplicate > 0 && (
            <p className="mt-1 text-text-secondary">
              {validation.duplicate.toLocaleString("vi-VN")} thẻ trùng được bỏ qua.
            </p>
          )}
        </div>
      )}

      {!overLimit && hasValidCards && (
        <>
          <div className="flex flex-col gap-2">
            <Label htmlFor="create-summary-name">Tên bộ</Label>
            <Input
              id="create-summary-name"
              placeholder="Nhập tên bộ flashcard"
              value={name}
              maxLength={SET_NAME_MAX_LENGTH}
              onChange={(e) => setName(e.target.value)}
              disabled={importing}
            />
          </div>
          <Button onClick={() => void handleCreate()} disabled={!canCreate}>
            {importing ? (
              <>
                <MascotImage
                  level={mascotLevel}
                  state="thinking"
                  size={24}
                  className="size-6 object-contain"
                />
                Đang tạo...
              </>
            ) : (
              "Tạo bộ flashcard"
            )}
          </Button>
        </>
      )}

      {hasValidCards && !overLimit && editableCards.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="font-semibold text-text-primary">Xem trước thẻ</h3>
          <ul className="flex flex-col gap-3">
            {editableCards.slice(0, IMPORT_PREVIEW_ROWS).map((card, i) => (
              <li key={i} className="flex gap-2">
                <div className="flex flex-1 flex-col gap-2 sm:flex-row">
                  <Input
                    placeholder="Mặt trước"
                    value={card.front}
                    onChange={(e) => {
                      const newCards = [...editableCards];
                      newCards[i] = { ...card, front: e.target.value };
                      setEditableCards(newCards);
                    }}
                  />
                  <Input
                    placeholder="Mặt sau"
                    value={card.back}
                    onChange={(e) => {
                      const newCards = [...editableCards];
                      newCards[i] = { ...card, back: e.target.value };
                      setEditableCards(newCards);
                    }}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 shrink-0"
                  aria-label={`Xóa thẻ ${i + 1}`}
                  onClick={() => {
                    const newCards = [...editableCards];
                    newCards.splice(i, 1);
                    setEditableCards(newCards);
                  }}
                >
                  <TrashIcon className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
          {editableCards.length > IMPORT_PREVIEW_ROWS && (
            <p className="text-sm text-text-secondary">
              ... và {editableCards.length - IMPORT_PREVIEW_ROWS} thẻ khác (vẫn sẽ được tạo nhưng bị
              ẩn để tối ưu tốc độ).
            </p>
          )}
        </div>
      )}

      {error && (
        <p
          className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
          role="alert"
        >
          {error}
        </p>
      )}

      {children}
    </div>
  );
}
