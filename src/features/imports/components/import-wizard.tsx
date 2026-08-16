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
import { columnIndexToLetters } from "@/features/imports/utils/sheets-a1";
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
  const sheet = sheets[sheetIndex];
  const columnOptions = useMemo(() => {
    if (!sheet?.rows || sheet.rows.length === 0) return [];
    const headerRow = sheet.rows[0] ?? [];
    const maxCols = Math.max(...sheet.rows.map((r) => r.length), headerRow.length);

    const list: Array<{ index: number; label: string }> = [];
    for (let colIdx = 0; colIdx < maxCols; colIdx += 1) {
      const hasData = sheet.rows.some((row) => (row[colIdx] ?? "").trim().length > 0);
      if (hasData) {
        const headerText = headerRow[colIdx]?.trim();
        const colLetter = columnIndexToLetters(colIdx);
        list.push({
          index: colIdx,
          label: headerText || colLetter,
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
          <div className="grid grid-cols-1 gap-4 rounded-2xl border border-border-soft bg-surface p-4 sm:grid-cols-3 sm:p-5">
            <div>
              <Label htmlFor="sheet" className="text-sm font-semibold text-text-primary">
                1. Trang tính
              </Label>
              <select
                id="sheet"
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
            <div>
              <Label htmlFor="front-column" className="text-sm font-semibold text-text-primary">
                2. Mặt trước
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
              <Label htmlFor="back-column" className="text-sm font-semibold text-text-primary">
                3. Mặt sau
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
          {hasSameColumns ? (
            <p role="alert" className="text-danger">
              Mặt trước và mặt sau phải dùng hai cột khác nhau.
            </p>
          ) : null}
          {typeof summary === "string" ? (
            <p role="alert" className="text-danger">
              {summary}
            </p>
          ) : null}
          {summary && typeof summary !== "string" ? (
            <CreateSummary
              key={`excel-${sheetIndex}-${frontColumn}-${backColumn}`}
              sourceCards={summary.rows}
              sourceMetadata={[{ label: "Nguồn", value: "Excel" }]}
              mascotLevel={mascotLevel}
            >
              <Button type="button" variant="outline" onClick={reset}>
                Thay tệp
              </Button>
            </CreateSummary>
          ) : null}
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
