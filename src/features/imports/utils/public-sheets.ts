import type { GoogleSheetMeta, SheetData } from "../adapters/google-sheets-adapter";
import { extractSpreadsheetId } from "../utils/extract-spreadsheet-id";
import { buildA1Range } from "../utils/sheets-a1";
import { GOOGLE_SHEETS_MAX_COLUMNS, IMPORT_MAX_ROWS } from "@/lib/constants";

const SHEETS_API_BASE = "https://sheets.googleapis.com/v4/spreadsheets";

export type PublicSheetFetchResult =
  | { kind: "success"; meta: GoogleSheetMeta; sheetData: SheetData }
  | { kind: "error"; message: string }
  | { kind: "auth_required"; message: string };

async function sheetsJson(url: string, apiKey: string): Promise<{ json: unknown; status: number }> {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  const json = await res.json().catch(() => null);
  return { json, status: res.status };
}

export function parseSpreadsheetMeta(json: unknown): GoogleSheetMeta {
  const meta = json as {
    properties?: { title?: string };
    sheets?: Array<{ properties?: { sheetId?: number; title?: string; index?: number } }>;
  };
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

export function parseSheetValues(json: unknown, sheetTitle: string): SheetData {
  const values = (json as { values?: unknown }).values;
  const rows: string[][] = Array.isArray(values)
    ? (values as unknown[][]).map((row) => (Array.isArray(row) ? row.map(String) : []))
    : [];
  const limited = rows.slice(0, IMPORT_MAX_ROWS + 1);
  const headers = (limited[0] ?? []).map((cell) => String(cell ?? ""));
  const dataRows = limited.slice(1);
  return { headers, rows: dataRows, rowCount: Math.max(0, rows.length - 1) };
}

export function validatePublicSpreadsheetUrl(
  url: string,
): { ok: true; spreadsheetId: string } | { ok: false } {
  const spreadsheetId = extractSpreadsheetId(url);
  if (!spreadsheetId) return { ok: false };
  return { ok: true, spreadsheetId };
}

export async function fetchPublicSpreadsheet(
  url: string,
  apiKey: string,
  sheetIndex = 0,
): Promise<PublicSheetFetchResult> {
  const validated = validatePublicSpreadsheetUrl(url);
  if (!validated.ok) return { kind: "error", message: "Liên kết Google Sheets không hợp lệ." };
  const spreadsheetId = validated.spreadsheetId;

  const metaUrl = `${SHEETS_API_BASE}/${spreadsheetId}?key=${apiKey}&fields=properties.title,sheets.properties(sheetId,title,index)`;
  const metaResult = await sheetsJson(metaUrl, apiKey);

  if (metaResult.status === 401 || metaResult.status === 403) {
    return {
      kind: "auth_required",
      message: "Bảng tính này cần quyền truy cập. Hãy chọn bảng tính từ Google Drive.",
    };
  }
  if (metaResult.status !== 200) return { kind: "error", message: "Không thể đọc bảng tính." };

  const meta = parseSpreadsheetMeta(metaResult.json);
  const sheet = meta.sheets[sheetIndex];
  if (!sheet) return { kind: "error", message: "Sheet không tồn tại." };

  const range = buildA1Range(sheet.title, IMPORT_MAX_ROWS + 1, GOOGLE_SHEETS_MAX_COLUMNS);
  const valuesUrl = `${SHEETS_API_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}?key=${apiKey}&majorDimension=ROWS`;
  const valuesResult = await sheetsJson(valuesUrl, apiKey);

  if (valuesResult.status === 401 || valuesResult.status === 403) {
    return {
      kind: "auth_required",
      message: "Bảng tính này cần quyền truy cập. Hãy chọn bảng tính từ Google Drive.",
    };
  }
  if (valuesResult.status !== 200)
    return { kind: "error", message: "Không thể đọc dữ liệu bảng tính." };

  const sheetData = parseSheetValues(valuesResult.json, sheet.title);
  return { kind: "success", meta, sheetData };
}
