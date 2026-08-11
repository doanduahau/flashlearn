"use client";

import { useRef, useState, useTransition } from "react";

import { extractDocument } from "@/features/imports/server/extract-document";
import { analyzeDocument } from "@/features/imports/server/analyze-document";
import { generateDocumentCards } from "@/features/imports/server/generate-document-cards";
import type {
  AnalyzedDocument,
  ExtractedDocument,
  ExtractedDocumentBlock,
} from "@/features/imports/types/document-types";
import type { DraftFlashcard } from "@/features/imports/types/import-types";
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
  const [analysis, setAnalysis] = useState<AnalyzedDocument | null>(null);
  const [generatedCards, setGeneratedCards] = useState<DraftFlashcard[] | null>(null);
  const [genWarnings, setGenWarnings] = useState<string[]>([]);
  const [genLimitExceeded, setGenLimitExceeded] = useState(false);
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setExtraction(null);
    setAnalysis(null);
    setGeneratedCards(null);
    setGenWarnings([]);
    setError("");
    setFileName("");
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleFile(file: File | undefined): Promise<void> {
    if (!file) return;
    setFileName(file.name);
    setError("");
    setAnalysis(null);

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

          // Auto-analyze after extraction
          try {
            const analysisResult = await analyzeDocument(result.document);
            if ("document" in analysisResult) {
              setAnalysis(analysisResult.document);
            }
          } catch {
            // Analysis is optional; extraction result remains visible.
          }
        }
      } catch {
        setError("Không thể đọc tệp. Hãy thử lại.");
      }
    });
  }

  async function handleGenerate(): Promise<void> {
    if (!analysis) return;
    setError("");
    setGeneratedCards(null);
    setGenWarnings([]);
    setGenLimitExceeded(false);
    startTransition(async () => {
      try {
        const result = await generateDocumentCards(analysis);
        if ("error" in result) {
          setError(result.error);
        } else {
          setGeneratedCards(result.cards);
          setGenWarnings(result.warnings);
          setGenLimitExceeded(result.limitExceeded);
        }
      } catch {
        setError("Không thể tạo thẻ. Hãy thử lại.");
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

            {analysis && analysis.sections.length > 0 && (
              <div className="flex flex-wrap gap-2 text-xs">
                {analysis.sections.some((s) => s.kind === "flashcard_like") && (
                  <span className="rounded-full bg-primary-soft px-2 py-0.5 text-primary-foreground">
                    {analysis.sections.filter((s) => s.kind === "flashcard_like").length} mục thẻ
                  </span>
                )}
                {analysis.sections.some((s) => s.kind === "prose") && (
                  <span className="rounded-full bg-surface px-2 py-0.5">
                    {analysis.sections.filter((s) => s.kind === "prose").length} mục văn bản
                  </span>
                )}
                {analysis.sections.some((s) => s.kind === "mixed") && (
                  <span className="rounded-full bg-surface px-2 py-0.5">
                    {analysis.sections.filter((s) => s.kind === "mixed").length} mục hỗn hợp
                  </span>
                )}
              </div>
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

          {analysis && !generatedCards && (
            <Button onClick={() => void handleGenerate()} disabled={isPending}>
              {isPending ? "Đang tạo..." : "Tạo thẻ"}
            </Button>
          )}

          {generatedCards && generatedCards.length > 0 && (
            <div className="flex flex-col gap-3 rounded-xl border border-border-soft bg-surface p-3">
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-text-secondary">
                  {generatedCards.length} thẻ đã tạo
                </span>
                {genLimitExceeded && (
                  <span className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-text-primary">
                    Tài liệu này tạo ra nhiều thẻ hơn mức tối đa cho phép. Không thể tiếp tục
                    import; vui lòng tách nội dung thành nhiều tài liệu.
                  </span>
                )}
                {genWarnings.length > 0 && (
                  <span className="text-xs text-text-secondary">{genWarnings.join(", ")}</span>
                )}
              </div>
              <div className="max-h-64 overflow-y-auto rounded-lg border border-border-soft">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="sticky top-0 bg-surface-subtle">
                    <tr className="text-xs text-text-secondary">
                      <th className="px-3 py-2 font-medium sm:px-4">Mặt trước</th>
                      <th className="px-3 py-2 font-medium sm:px-4">Mặt sau</th>
                    </tr>
                  </thead>
                  <tbody>
                    {generatedCards.map((card, i) => (
                      <tr key={i} className="border-t border-border-soft">
                        <td className="px-3 py-2 sm:px-4">{card.front}</td>
                        <td className="px-3 py-2 sm:px-4">{card.back}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
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
