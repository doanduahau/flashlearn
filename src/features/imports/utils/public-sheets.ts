import type { GoogleSheetMeta, SheetData } from "../adapters/google-sheets-adapter";
import { extractSpreadsheetId } from "../utils/extract-spreadsheet-id";
import { buildDataColumnRange, buildHeaderScanRange } from "../utils/sheets-a1";
import { parseColumnBodies, parseHeaderScan, parseSpreadsheetMeta } from "../utils/sheets-parser";
import { GOOGLE_SHEETS_HEADER_SCAN_MAX_COLUMNS, IMPORT_MAX_ROWS } from "@/lib/constants";

const SHEETS_API_BASE = "https://sheets.googleapis.com/v4/spreadsheets";
const CLIENT_REQUEST_INTERVAL_MS = 500;
let nextRequestAt = 0;

export type PublicSheetOpenResult =
  | { kind: "success"; meta: GoogleSheetMeta; headers: string[]; sheetTitle: string }
  | { kind: "error"; message: string; status?: number; detail?: string }
  | { kind: "auth_required"; message: string };

export type PublicSheetValuesResult =
  | { kind: "success"; sheetData: SheetData }
  | { kind: "error"; message: string; status?: number; detail?: string }
  | { kind: "auth_required"; message: string };

// Google error responses carry { error: { message } } — surface the real reason
// (rate limit, grid limits, invalid range, …) instead of a generic message.
function googleErrorDetail(json: unknown): string {
  const err = (json as { error?: { message?: string } } | null)?.error;
  return typeof err?.message === "string" ? err.message : "";
}

async function sheetsJson(url: string): Promise<{ json: unknown; status: number }> {
  const waitMs = Math.max(0, nextRequestAt - Date.now());
  if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
  nextRequestAt = Date.now() + CLIENT_REQUEST_INTERVAL_MS;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    const json = await res.json().catch(() => null);
    return { json, status: res.status };
  } finally {
    clearTimeout(timeout);
  }
}

export function validatePublicSpreadsheetUrl(
  url: string,
): { ok: true; spreadsheetId: string } | { ok: false } {
  const spreadsheetId = extractSpreadsheetId(url);
  if (!spreadsheetId) return { ok: false };
  return { ok: true, spreadsheetId };
}

export { parseSpreadsheetMeta };

export async function fetchPublicSpreadsheet(
  url: string,
  apiKey: string,
  sheetIndex = 0,
): Promise<PublicSheetOpenResult> {
  const validated = validatePublicSpreadsheetUrl(url);
  if (!validated.ok) return { kind: "error", message: "Liên kết Google Sheets không hợp lệ." };
  const spreadsheetId = validated.spreadsheetId;

  const metaUrl = `${SHEETS_API_BASE}/${spreadsheetId}?key=${apiKey}&fields=properties.title,sheets.properties(sheetId,title,index)`;
  const metaResult = await sheetsJson(metaUrl);

  if (metaResult.status === 401 || metaResult.status === 403) {
    return {
      kind: "auth_required",
      message: "Bảng tính này cần quyền truy cập. Hãy chọn bảng tính từ Google Drive.",
    };
  }
  if (metaResult.status !== 200) {
    return {
      kind: "error",
      message: "Không thể đọc bảng tính.",
      status: metaResult.status,
      detail: googleErrorDetail(metaResult.json),
    };
  }

  const meta = parseSpreadsheetMeta(metaResult.json);
  const sheet = meta.sheets[sheetIndex];
  if (!sheet) return { kind: "error", message: "Sheet không tồn tại." };

  const range = buildHeaderScanRange(sheet.title, GOOGLE_SHEETS_HEADER_SCAN_MAX_COLUMNS);
  const headerUrl = `${SHEETS_API_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}?key=${apiKey}`;
  const headerResult = await sheetsJson(headerUrl);

  if (headerResult.status === 401 || headerResult.status === 403) {
    return {
      kind: "auth_required",
      message: "Bảng tính này cần quyền truy cập. Hãy chọn bảng tính từ Google Drive.",
    };
  }
  if (headerResult.status !== 200) {
    return {
      kind: "error",
      message: "Không thể đọc bảng tính.",
      status: headerResult.status,
      detail: googleErrorDetail(headerResult.json),
    };
  }

  const headers = parseHeaderScan(headerResult.json);
  return { kind: "success", meta, headers, sheetTitle: sheet.title };
}

export async function fetchPublicSheetValues(
  spreadsheetId: string,
  sheetTitle: string,
  apiKey: string,
  columns: number[],
): Promise<PublicSheetValuesResult> {
  if (columns.length === 0 || columns.length > 26) {
    return { kind: "error", message: "Cột không hợp lệ." };
  }

  const ranges = columns.map((col) => buildDataColumnRange(sheetTitle, col, IMPORT_MAX_ROWS));
  const rangesParam = ranges.map((r) => `ranges=${encodeURIComponent(r)}`).join("&");
  const url = `${SHEETS_API_BASE}/${spreadsheetId}/values:batchGet?${rangesParam}&majorDimension=ROWS&key=${apiKey}`;
  const valuesResult = await sheetsJson(url);

  if (valuesResult.status === 401 || valuesResult.status === 403) {
    return {
      kind: "auth_required",
      message: "Bảng tính này cần quyền truy cập. Hãy chọn bảng tính từ Google Drive.",
    };
  }
  if (valuesResult.status !== 200) {
    return {
      kind: "error",
      message: "Không thể đọc dữ liệu bảng tính.",
      status: valuesResult.status,
      detail: googleErrorDetail(valuesResult.json),
    };
  }

  const result = parseColumnBodies(valuesResult.json, columns);
  return {
    kind: "success",
    sheetData: {
      headers: result.headers,
      rows: result.rows.slice(0, IMPORT_MAX_ROWS),
      rowCount: Math.min(result.rowCount, IMPORT_MAX_ROWS),
    },
  };
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
