"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { MascotImage } from "@/features/mascot/components/mascot-image";
import { importFlashcards } from "@/features/imports/server/actions";
import type { DraftFlashcard } from "@/features/imports/types/import-types";
import { validateDraftCards } from "@/features/imports/utils/validate-draft-cards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IMPORT_MAX_ROWS, SET_NAME_MAX_LENGTH } from "@/lib/constants";

export type CreateSummaryMetadata = {
  label?: string;
  value?: string;
};

type Props = {
  sourceCards: DraftFlashcard[];
  sourceMetadata?: CreateSummaryMetadata[];
  warnings?: string[];
  limitExceeded?: boolean;
  children?: React.ReactNode;
};

export function CreateSummary({
  sourceCards,
  sourceMetadata,
  warnings,
  limitExceeded,
  children,
}: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const importInFlightRef = useRef(false);

  const validation = useMemo(() => {
    try {
      return validateDraftCards(sourceCards);
    } catch {
      return null;
    }
  }, [sourceCards]);

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
                  level={1}
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
