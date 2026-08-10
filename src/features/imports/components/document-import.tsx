"use client";

import { useRef, useState, useTransition } from "react";

import { extractDocument } from "@/features/imports/server/extract-document";
import type {
  ExtractedDocument,
  ExtractedDocumentBlock,
} from "@/features/imports/types/document-types";
import { DOCUMENT_MAX_BYTES } from "@/lib/constants";
import { Button } from "@/components/ui/button";

const SUPPORTED_TYPES = ".docx,.pdf";

function blockLabel(block: ExtractedDocumentBlock): string {
  if (block.type === "heading") return `H${block.level}`;
  if (block.type === "table") return "Bảng";
  return "Đoạn";
}

function renderBlock(block: ExtractedDocumentBlock) {
  if (block.type === "table") {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs sm:text-sm">
          <tbody>
            {block.rows.map((row, ri) => (
              <tr
                key={ri}
                className={
                  ri === 0 ? "font-medium bg-surface-subtle" : "border-t border-border-soft"
                }
              >
                {row.map((cell, ci) => (
                  <td key={ci} className="px-2 py-1 sm:px-3">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return <p className="text-sm whitespace-pre-wrap">{block.text}</p>;
}

export function DocumentImport() {
  const [extraction, setExtraction] = useState<ExtractedDocument | null>(null);
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setExtraction(null);
    setError("");
    setFileName("");
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleFile(file: File | undefined): Promise<void> {
    if (!file) return;
    setFileName(file.name);
    setError("");

    if (file.size > DOCUMENT_MAX_BYTES) {
      setError(`Tệp quá lớn. Tối đa ${Math.round(DOCUMENT_MAX_BYTES / (1024 * 1024))} MB.`);
      return;
    }

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("file", file);
        const result = await extractDocument(formData);

        if ("error" in result) {
          setError(result.error);
          setExtraction(null);
        } else {
          setExtraction(result.document);
        }
      } catch {
        setError("Không thể đọc tệp. Hãy thử lại.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border-soft p-6">
        <p className="text-sm text-text-secondary">Chọn tệp Word (.docx) hoặc PDF</p>
        <input
          ref={inputRef}
          type="file"
          accept={SUPPORTED_TYPES}
          className="block w-full text-sm text-text-secondary file:mr-3 file:rounded-lg file:border-0 file:bg-primary-soft file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground"
          onChange={(e) => {
            void handleFile(e.target.files?.[0]);
          }}
          disabled={isPending}
        />
      </div>

      {isPending && <p className="text-sm text-text-secondary">Đang đọc tài liệu...</p>}

      {extraction && (
        <div className="flex flex-col gap-3 rounded-xl border border-border-soft bg-surface-subtle p-3 sm:rounded-2xl sm:p-5">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">{fileName}</p>
            <div className="flex flex-wrap gap-2 text-xs text-text-secondary">
              {extraction.sourceType === "pdf" && extraction.pageCount !== undefined && (
                <span>{extraction.pageCount} trang</span>
              )}
              <span>{extraction.blocks.length} khối nội dung</span>
              <span>{extraction.totalCharacters.toLocaleString("vi-VN")} ký tự</span>
            </div>
            {extraction.pagesWithoutText !== undefined && extraction.pagesWithoutText > 0 && (
              <span className="text-xs text-text-secondary">
                ({extraction.pagesWithoutText} trang không có văn bản)
              </span>
            )}
          </div>

          {extraction.blocks.length > 0 && (
            <div className="max-h-96 overflow-y-auto rounded-xl border border-border-soft bg-surface p-3">
              <div className="space-y-3">
                {extraction.blocks.map((block, i) => (
                  <div key={i} className="flex flex-col gap-1">
                    <span className="text-[10px] font-medium uppercase tracking-wide text-text-secondary">
                      {blockLabel(block)}
                      {block.page !== undefined ? ` · trang ${block.page}` : ""}
                    </span>
                    {renderBlock(block)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {extraction.sourceType === "pdf" && extraction.blocks.length === 0 && (
            <p className="text-sm text-text-secondary">
              PDF này không có văn bản có thể đọc. FlashLearn hiện chưa hỗ trợ PDF scan/ảnh.
            </p>
          )}

          <Button variant="outline" size="sm" onClick={reset} disabled={isPending}>
            Chọn tệp khác
          </Button>
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
    </div>
  );
}
