import type { GoogleSheetMeta, SheetData } from "../adapters/google-sheets-adapter";
import { GOOGLE_SHEETS_HEADER_SCAN_MAX_COLUMNS, IMPORT_MAX_ROWS } from "@/lib/constants";

export type SheetMetaJson = {
  properties?: { title?: string };
  sheets?: Array<{ properties?: { sheetId?: number; title?: string; index?: number } }>;
};

export function parseSpreadsheetMeta(json: unknown): GoogleSheetMeta {
  const meta = json as SheetMetaJson;
  const title = meta.properties?.title ?? "Google Sheets";
  const sheets: GoogleSheetMeta["sheets"] = [];
  for (const s of meta.sheets ?? []) {
    const p = s.properties ?? {};
    sheets.push({
      title: p.title ?? `Sheet ${sheets.length + 1}`,
      sheetId: p.sheetId ?? sheets.length,
      index: p.index ?? sheets.length,
    });
  }
  return { spreadsheetTitle: title, sheets };
}

export function parseHeaderScan(json: unknown): string[] {
  const values = (json as { values?: unknown }).values;
  const rows = Array.isArray(values) ? (values as unknown[][]) : [];

  return Array.from({ length: GOOGLE_SHEETS_HEADER_SCAN_MAX_COLUMNS }, (_, colIdx) => {
    for (let r = 0; r < Math.min(rows.length, 20); r += 1) {
      const row = rows[r];
      if (Array.isArray(row)) {
        const text = String(row[colIdx] ?? "").trim();
        if (text.length > 0) return text;
      }
    }
    return "";
  });
}

export type ColumnBodiesResult = {
  headers: string[];
  rows: string[][];
  rowCount: number;
};

export function parseColumnBodies(json: unknown, columns: number[]): ColumnBodiesResult {
  const valueRanges = (json as { valueRanges?: unknown[] }).valueRanges ?? [];
  const bodies = valueRanges.map((range) => {
    const r = range as { values?: unknown };
    return Array.isArray(r.values)
      ? (r.values as unknown[][]).map((cellRow) =>
          Array.isArray(cellRow) ? String(cellRow[0] ?? "") : "",
        )
      : [];
  });

  const maxColumn = Math.max(...columns, 0);
  const width = maxColumn + 1;
  const headers: string[] = Array.from({ length: width }, () => "");
  const rows: string[][] = [];

  for (let i = 0; i < bodies.length; i += 1) {
    const colIdx = columns[i];
    const values = bodies[i];
    if (colIdx === undefined) continue;
    headers[colIdx] = values[0] ?? "";
    for (let rowIdx = 1; rowIdx < values.length; rowIdx += 1) {
      const value = values[rowIdx] ?? "";
      const targetRow = rowIdx - 1;
      if (targetRow >= IMPORT_MAX_ROWS) break;
      if (!rows[targetRow]) rows[targetRow] = Array.from({ length: width }, () => "");
      rows[targetRow]![colIdx] = value;
    }
  }

  return { headers, rows, rowCount: rows.length };
}

export function parseSheetValues(json: unknown, _sheetTitle: string): SheetData {
  const values = (json as { values?: unknown }).values;
  const rows: string[][] = Array.isArray(values)
    ? (values as unknown[][]).map((row) => (Array.isArray(row) ? row.map(String) : []))
    : [];
  const limited = rows.slice(0, IMPORT_MAX_ROWS + 1);
  const headers = (limited[0] ?? []).map((cell) => String(cell ?? ""));
  const dataRows = limited.slice(1);
  return { headers, rows: dataRows, rowCount: Math.max(0, rows.length - 1) };
}
