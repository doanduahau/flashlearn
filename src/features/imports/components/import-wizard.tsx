"use client";

import { useMemo, useRef, useState } from "react";

import { sheetToDraftCards } from "@/features/imports/adapters/excel-adapter";
import { parseWorkbook, validateImportFile } from "@/features/imports/utils/parse-workbook";
import { validateDraftCards } from "@/features/imports/utils/validate-draft-cards";
import { UnifiedDraftEditor } from "@/features/imports/components/unified-draft-editor";
import { MascotImage } from "@/features/mascot/components/mascot-image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ParsedSheet } from "@/features/imports/types/import-types";

export function ImportWizard() {
  const inputRef = useRef<HTMLInputElement>(null);
  const parsingRef = useRef(false);
  const [sheets, setSheets] = useState<ParsedSheet[]>([]);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [frontColumn, setFrontColumn] = useState(0);
  const [backColumn, setBackColumn] = useState(1);
  const [error, setError] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const sheet = sheets[sheetIndex];
  const headers = sheet?.rows[0] ?? [];
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
  const options = headers.map((header, index) => (
    <option key={index} value={index}>
      {header.trim() || "Cột trống"} ({index + 1})
    </option>
  ));
  return (
    <div className="space-y-6">
      {!sheet ? (
        <section className="rounded-3xl border border-dashed border-border-soft bg-surface-subtle p-6 text-center">
          <MascotImage
            level={1}
            state="thinking"
            size={48}
            className="mx-auto size-12 object-contain"
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
              <MascotImage level={1} state="thinking" size={32} className="size-8 object-contain" />
              <p>{"\u0110ang \u0111\u1ecdc t\u1ec7p..."}</p>
            </div>
          ) : null}
        </section>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-4 rounded-2xl border border-border-soft bg-surface p-5">
            <div className="min-w-48 flex-1">
              <Label htmlFor="sheet">1. Trang tính</Label>
              <select
                id="sheet"
                className="mt-1 w-full rounded-xl border p-2"
                value={sheetIndex}
                onChange={(event) => {
                  setSheetIndex(Number(event.target.value));
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
            <div className="min-w-48 flex-1">
              <Label htmlFor="front-column">2. Mặt trước</Label>
              <select
                id="front-column"
                className="mt-1 w-full rounded-xl border p-2"
                value={frontColumn}
                onChange={(event) => setFrontColumn(Number(event.target.value))}
              >
                {options}
              </select>
            </div>
            <div className="min-w-48 flex-1">
              <Label htmlFor="back-column">3. Mặt sau</Label>
              <select
                id="back-column"
                className="mt-1 w-full rounded-xl border p-2"
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
            <UnifiedDraftEditor
              key={`excel-${sheetIndex}-${frontColumn}-${backColumn}`}
              sourceCards={summary.rows}
              setCardCount={summary.rows.length}
              sourceMetadata={[{ label: "Nguồn", value: "Excel" }]}
            >
              <Button type="button" variant="outline" onClick={reset}>
                Thay tệp
              </Button>
            </UnifiedDraftEditor>
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
