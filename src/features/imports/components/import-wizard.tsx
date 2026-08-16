"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { sheetToDraftCards } from "@/features/imports/adapters/excel-adapter";
import { parseWorkbook, validateImportFile } from "@/features/imports/utils/parse-workbook";
import { validateDraftCards } from "@/features/imports/utils/validate-draft-cards";
import { CreateSummary } from "@/features/imports/components/create-summary";
import { MascotImage } from "@/features/mascot/components/mascot-image";
import type { MascotLevel } from "@/features/mascot/types/mascot-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ParsedSheet } from "@/features/imports/types/import-types";

export function ImportWizard({
  initialFile,
  mascotLevel,
}: Readonly<{ initialFile?: File; mascotLevel: MascotLevel }>) {
  const inputRef = useRef<HTMLInputElement>(null);
  const parsingRef = useRef(false);
  const initialFileRef = useRef(initialFile);
  const [sheets, setSheets] = useState<ParsedSheet[]>([]);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [frontColumn, setFrontColumn] = useState(0);
  const [backColumn, setBackColumn] = useState(1);
  const [error, setError] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [isAnalyzed, setIsAnalyzed] = useState(false);
  const sheet = sheets[sheetIndex];
  const columnOptions = useMemo(() => {
    if (!sheet?.rows || sheet.rows.length === 0) return [];
    const maxCols = Math.max(...sheet.rows.map((r) => r.length));
    // Every column that holds any data is offered, no matter how far down its
    // first value sits; the label is that first non-empty cell.
    const scanLimit = sheet.rows.length;

    const list: Array<{ index: number; label: string }> = [];
    for (let colIdx = 0; colIdx < maxCols; colIdx += 1) {
      let foundText = "";
      for (let r = 0; r < scanLimit; r += 1) {
        const cell = (sheet.rows[r]?.[colIdx] ?? "").trim();
        if (cell.length > 0) {
          foundText = cell;
          break;
        }
      }
      if (foundText.length > 0) {
        list.push({
          index: colIdx,
          label: foundText,
        });
      }
    }
    return list;
  }, [sheet]);

  const hasSameColumns = Boolean(sheet) && frontColumn === backColumn;
  const summary = useMemo(() => {
    if (!sheet || frontColumn === backColumn) return null;
    try {
      const draftCards = sheetToDraftCards(sheet, frontColumn, backColumn);
      const validation = validateDraftCards(draftCards);
      return {
        valid: validation.valid,
        blank: validation.blank,
        partial: validation.partial,
        duplicate: validation.duplicate,
        rows: validation.cards,
      };
    } catch (reason) {
      return reason instanceof Error ? reason.message : "Dữ liệu không hợp lệ.";
    }
  }, [sheet, frontColumn, backColumn]);

  useEffect(() => {
    if (initialFileRef.current) {
      void selectFile(initialFileRef.current);
      initialFileRef.current = undefined;
    }
  }, []);

  function reset(): void {
    setSheets([]);
    setSheetIndex(0);
    setFrontColumn(0);
    setBackColumn(1);
    setIsAnalyzed(false);
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  }

  async function selectFile(file: File | undefined): Promise<void> {
    if (!file || parsingRef.current) return;
    const validation = validateImportFile(file);
    if (validation) {
      setError(validation);
      return;
    }
    parsingRef.current = true;
    setIsParsing(true);
    try {
      const parsed = await parseWorkbook(file);
      if (!parsed.length || !parsed.some((item) => item.rows.length > 1)) throw new Error();
      setSheets(parsed);
      setSheetIndex(0);
      setFrontColumn(0);
      setBackColumn(1);
      setIsAnalyzed(false);
      setError("");
    } catch {
      setError("Không thể đọc tệp này. Hãy dùng CSV hoặc XLSX hợp lệ.");
    } finally {
      parsingRef.current = false;
      setIsParsing(false);
    }
  }

  const options = columnOptions.map((col) => (
    <option key={col.index} value={col.index}>
      {col.label}
    </option>
  ));

  return (
    <div className="space-y-6">
      {!sheet ? (
        <section className="rounded-3xl border border-dashed border-border-soft bg-surface-subtle p-6 text-center">
          <MascotImage
            level={mascotLevel}
            state="thinking"
            size={64}
            className="mx-auto size-16 object-contain"
          />
          <Label htmlFor="import-file" className="block cursor-pointer text-lg font-semibold">
            Chọn hoặc kéo tệp CSV/XLSX vào đây
          </Label>
          <p className="mt-2 text-sm text-text-secondary">
            Tối đa 5 MB. Tệp gốc chỉ được đọc trong trình duyệt và không được lưu.
          </p>
          <Input
            ref={inputRef}
            id="import-file"
            className="mx-auto mt-4 max-w-sm"
            type="file"
            accept=".xlsx,.csv"
            disabled={isParsing}
            aria-busy={isParsing}
            onChange={(event) => void selectFile(event.target.files?.[0])}
            onDrop={(event) => {
              event.preventDefault();
              void selectFile(event.dataTransfer.files[0]);
            }}
          />
          {isParsing ? (
            <div
              role="status"
              className="mt-3 flex items-center justify-center gap-2 text-sm text-text-secondary"
            >
              <MascotImage
                level={mascotLevel}
                state="thinking"
                size={64}
                className="size-16 object-contain"
              />
              <p>{"\u0110ang \u0111\u1ecdc t\u1ec7p..."}</p>
            </div>
          ) : null}
        </section>
      ) : (
        <>
          {!isAnalyzed ? (
            <div className="space-y-4 rounded-2xl border border-border-soft bg-surface p-5">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-text-secondary">Tệp đã sẵn sàng</span>
                <p className="font-bold text-text-primary">
                  {sheet.name} ({Math.max(0, sheet.rows.length - 1)} dòng dữ liệu)
                </p>
              </div>

              {sheets.length > 1 && (
                <div>
                  <Label
                    htmlFor="sheet-select-pre"
                    className="text-sm font-semibold text-text-primary"
                  >
                    1. Chọn trang tính
                  </Label>
                  <select
                    id="sheet-select-pre"
                    className="mt-1.5 w-full cursor-pointer rounded-xl border border-border-soft bg-surface px-3 py-2.5 text-sm font-medium text-text-primary transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    value={sheetIndex}
                    onChange={(event) => {
                      const newIdx = Number(event.target.value);
                      setSheetIndex(newIdx);
                      setFrontColumn(0);
                      setBackColumn(1);
                    }}
                  >
                    {sheets.map((item, index) => (
                      <option key={item.name} value={index}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button type="button" onClick={() => setIsAnalyzed(true)}>
                  Phân tích
                </Button>
                <Button type="button" variant="outline" onClick={reset}>
                  Thay tệp
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="rounded-2xl border border-border-soft bg-surface p-4 sm:p-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Label
                      htmlFor="front-column"
                      className="text-sm font-semibold text-text-primary"
                    >
                      Mặt trước
                    </Label>
                    <select
                      id="front-column"
                      className="mt-1.5 w-full cursor-pointer rounded-xl border border-border-soft bg-surface px-3 py-2.5 text-sm font-medium text-text-primary transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      value={frontColumn}
                      onChange={(event) => setFrontColumn(Number(event.target.value))}
                    >
                      {options}
                    </select>
                  </div>
                  <div>
                    <Label
                      htmlFor="back-column"
                      className="text-sm font-semibold text-text-primary"
                    >
                      Mặt sau
                    </Label>
                    <select
                      id="back-column"
                      className="mt-1.5 w-full cursor-pointer rounded-xl border border-border-soft bg-surface px-3 py-2.5 text-sm font-medium text-text-primary transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      value={backColumn}
                      onChange={(event) => setBackColumn(Number(event.target.value))}
                    >
                      {options}
                    </select>
                  </div>
                </div>

                {sheets.length > 1 && (
                  <div className="mt-4 border-t border-border-soft pt-3">
                    <Label htmlFor="sheet" className="text-xs font-medium text-text-secondary">
                      Đổi trang tính
                    </Label>
                    <select
                      id="sheet"
                      className="mt-1 w-full cursor-pointer rounded-xl border border-border-soft bg-surface px-3 py-2 text-sm text-text-primary"
                      value={sheetIndex}
                      onChange={(event) => {
                        const newIdx = Number(event.target.value);
                        setSheetIndex(newIdx);
                        setFrontColumn(0);
                        setBackColumn(1);
                      }}
                    >
                      {sheets.map((item, index) => (
                        <option key={item.name} value={index}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {hasSameColumns ? (
                <p role="alert" className="text-danger font-medium">
                  Mặt trước và mặt sau phải dùng hai cột khác nhau.
                </p>
              ) : null}
              {typeof summary === "string" ? (
                <p role="alert" className="text-danger font-medium">
                  {summary}
                </p>
              ) : null}
              {summary && typeof summary !== "string" ? (
                <CreateSummary
                  key={`excel-${sheetIndex}-${frontColumn}-${backColumn}`}
                  sourceCards={summary.rows}
                  sourceMetadata={[{ label: "Nguồn", value: "Excel / CSV" }]}
                  mascotLevel={mascotLevel}
                >
                  <Button type="button" variant="outline" onClick={reset}>
                    Thay tệp
                  </Button>
                </CreateSummary>
              ) : null}
            </div>
          )}
        </>
      )}
      {error ? (
        <p role="alert" className="text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
