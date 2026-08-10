"use server";

import type { DraftFlashcard } from "@/features/imports/types/import-types";
import { GeminiFlashcardGenerationProvider } from "@/features/imports/adapters/gemini-provider";
import { semanticSheetToCards } from "@/features/imports/adapters/google-sheets-adapter";
import type { GoogleSheetMeta, SheetData } from "@/features/imports/adapters/google-sheets-adapter";
import { validateDraftCards } from "@/features/imports/utils/validate-draft-cards";
import { buildDataColumnRange, buildHeaderScanRange } from "@/features/imports/utils/sheets-a1";
import {
  parseColumnBodies,
  parseHeaderScan,
  parseSpreadsheetMeta,
} from "@/features/imports/utils/sheets-parser";
import { GOOGLE_SHEETS_HEADER_SCAN_MAX_COLUMNS, IMPORT_MAX_ROWS } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";

const SHEETS_API_BASE = "https://sheets.googleapis.com/v4/spreadsheets";

type SheetOpenResult =
  | { kind: "success"; meta: GoogleSheetMeta; headers: string[]; sheetTitle: string }
  | { kind: "auth_required"; message: string }
  | { kind: "error"; message: string };

type SheetValuesResult =
  | { kind: "success"; sheetData: SheetData }
  | { kind: "auth_required"; message: string }
  | { kind: "error"; message: string };

type SemanticResult =
  | {
      kind: "success";
      cards: DraftFlashcard[];
      valid: number;
      blank: number;
      partial: number;
      duplicate: number;
      aiUsed: boolean;
    }
  | { kind: "error"; message: string };

async function requireAuth(): Promise<boolean> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  return Boolean(claims?.claims);
}

function authHeaders(accessToken: string): Record<string, string> {
  return { Accept: "application/json", Authorization: `Bearer ${accessToken}` };
}

async function fetchSheetMetadata(
  spreadsheetId: string,
  accessToken: string,
): Promise<GoogleSheetMeta | { error: string; status: number }> {
  const metaUrl = `${SHEETS_API_BASE}/${spreadsheetId}?fields=properties.title,sheets.properties(sheetId,title,index)`;
  const metaRes = await fetch(metaUrl, { headers: authHeaders(accessToken) });
  if (!metaRes.ok) {
    if (metaRes.status === 401 || metaRes.status === 403)
      return { error: "Permission denied.", status: metaRes.status };
    return { error: "Không thể đọc bảng tính.", status: metaRes.status };
  }
  return parseSpreadsheetMeta(await metaRes.json());
}

async function fetchHeaderScan(
  spreadsheetId: string,
  sheetTitle: string,
  accessToken: string,
): Promise<string[] | { error: string; status: number }> {
  const range = buildHeaderScanRange(sheetTitle, GOOGLE_SHEETS_HEADER_SCAN_MAX_COLUMNS);
  const url = `${SHEETS_API_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}`;
  const res = await fetch(url, { headers: authHeaders(accessToken) });
  if (!res.ok) {
    if (res.status === 401 || res.status === 403)
      return { error: "Permission denied.", status: res.status };
    return { error: "Không thể đọc bảng tính.", status: res.status };
  }
  return parseHeaderScan(await res.json());
}

async function fetchColumnBodies(
  spreadsheetId: string,
  sheetTitle: string,
  columns: number[],
  accessToken: string,
): Promise<SheetData | { error: string; status: number }> {
  const ranges = columns.map((col) => buildDataColumnRange(sheetTitle, col, IMPORT_MAX_ROWS));
  const rangesParam = ranges.map((r) => `ranges=${encodeURIComponent(r)}`).join("&");
  const url = `${SHEETS_API_BASE}/${spreadsheetId}/values:batchGet?${rangesParam}&majorDimension=ROWS`;
  const res = await fetch(url, { headers: authHeaders(accessToken) });
  if (!res.ok) {
    if (res.status === 401 || res.status === 403)
      return { error: "Permission denied.", status: res.status };
    return { error: "Không thể đọc dữ liệu bảng tính.", status: res.status };
  }
  const result = parseColumnBodies(await res.json(), columns);
  return {
    headers: result.headers,
    rows: result.rows.slice(0, IMPORT_MAX_ROWS),
    rowCount: Math.min(result.rowCount, IMPORT_MAX_ROWS),
  };
}

function sanitizeSpreadsheetId(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function sanitizeAccessToken(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function sanitizeSheetIndex(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}

function sanitizeSheetTitle(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function sanitizeColumns(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const out: number[] = [];
  for (const item of value) {
    if (typeof item === "number" && Number.isFinite(item) && item >= 0) out.push(Math.floor(item));
  }
  return Array.from(new Set(out)).sort((a, b) => a - b);
}

export async function openGoogleSheet(rawInput: unknown): Promise<SheetOpenResult> {
  if (!(await requireAuth())) return { kind: "error", message: "Phiên đăng nhập đã hết hạn." };

  if (!rawInput || typeof rawInput !== "object") {
    return { kind: "error", message: "Dữ liệu không hợp lệ." };
  }

  const input = rawInput as Record<string, unknown>;
  const spreadsheetId = sanitizeSpreadsheetId(input.spreadsheetId);
  const accessToken = sanitizeAccessToken(input.accessToken);
  const sheetIndex = sanitizeSheetIndex(input.sheetIndex);

  if (!spreadsheetId || spreadsheetId.length < 30) {
    return { kind: "error", message: "Liên kết Google Sheets không hợp lệ." };
  }
  if (!accessToken) {
    return {
      kind: "auth_required",
      message: "Bảng tính này cần quyền truy cập. Hãy chọn bảng tính từ Google Drive.",
    };
  }

  const metaResult = await fetchSheetMetadata(spreadsheetId, accessToken);
  if ("error" in metaResult) {
    return metaResult.status === 401 || metaResult.status === 403
      ? {
          kind: "auth_required",
          message: "Bảng tính này cần quyền truy cập. Hãy chọn bảng tính từ Google Drive.",
        }
      : { kind: "error", message: metaResult.error };
  }

  const sheet = metaResult.sheets[sheetIndex];
  if (!sheet) return { kind: "error", message: "Sheet không tồn tại." };

  const headerResult = await fetchHeaderScan(spreadsheetId, sheet.title, accessToken);
  if ("error" in headerResult) {
    return headerResult.status === 401 || headerResult.status === 403
      ? {
          kind: "auth_required",
          message: "Bảng tính này cần quyền truy cập. Hãy chọn bảng tính từ Google Drive.",
        }
      : { kind: "error", message: headerResult.error };
  }

  return { kind: "success", meta: metaResult, headers: headerResult, sheetTitle: sheet.title };
}

export async function discoverPrivateSheetHeaders(rawInput: unknown): Promise<SheetOpenResult> {
  if (!(await requireAuth())) return { kind: "error", message: "Phiên đăng nhập đã hết hạn." };

  if (!rawInput || typeof rawInput !== "object") {
    return { kind: "error", message: "Dữ liệu không hợp lệ." };
  }

  const input = rawInput as Record<string, unknown>;
  const spreadsheetId = sanitizeSpreadsheetId(input.spreadsheetId);
  const accessToken = sanitizeAccessToken(input.accessToken);
  const sheetTitle = sanitizeSheetTitle(input.sheetTitle);

  if (!spreadsheetId || spreadsheetId.length < 30)
    return { kind: "error", message: "Liên kết Google Sheets không hợp lệ." };
  if (!sheetTitle) return { kind: "error", message: "Sheet không hợp lệ." };
  if (!accessToken) {
    return {
      kind: "auth_required",
      message: "Bảng tính này cần quyền truy cập. Hãy chọn bảng tính từ Google Drive.",
    };
  }

  const headerResult = await fetchHeaderScan(spreadsheetId, sheetTitle, accessToken);
  if ("error" in headerResult) {
    return headerResult.status === 401 || headerResult.status === 403
      ? {
          kind: "auth_required",
          message: "Bảng tính này cần quyền truy cập. Hãy chọn bảng tính từ Google Drive.",
        }
      : { kind: "error", message: headerResult.error };
  }

  return {
    kind: "success",
    meta: { spreadsheetTitle: sheetTitle, sheets: [] },
    headers: headerResult,
    sheetTitle,
  };
}

export async function loadPrivateSheetValues(rawInput: unknown): Promise<SheetValuesResult> {
  if (!(await requireAuth())) return { kind: "error", message: "Phiên đăng nhập đã hết hạn." };

  if (!rawInput || typeof rawInput !== "object") {
    return { kind: "error", message: "Dữ liệu không hợp lệ." };
  }

  const input = rawInput as Record<string, unknown>;
  const spreadsheetId = sanitizeSpreadsheetId(input.spreadsheetId);
  const accessToken = sanitizeAccessToken(input.accessToken);
  const sheetTitle = sanitizeSheetTitle(input.sheetTitle);
  const columns = sanitizeColumns(input.columns);

  if (!spreadsheetId || spreadsheetId.length < 30)
    return { kind: "error", message: "Liên kết Google Sheets không hợp lệ." };
  if (!sheetTitle) return { kind: "error", message: "Sheet không hợp lệ." };
  if (columns.length === 0 || columns.length > 2)
    return { kind: "error", message: "Cột không hợp lệ." };
  if (!accessToken) {
    return {
      kind: "auth_required",
      message: "Bảng tính này cần quyền truy cập. Hãy chọn bảng tính từ Google Drive.",
    };
  }

  const valuesResult = await fetchColumnBodies(spreadsheetId, sheetTitle, columns, accessToken);
  if ("error" in valuesResult) {
    return valuesResult.status === 401 || valuesResult.status === 403
      ? {
          kind: "auth_required",
          message: "Bảng tính này cần quyền truy cập. Hãy chọn bảng tính từ Google Drive.",
        }
      : { kind: "error", message: valuesResult.error };
  }

  return { kind: "success", sheetData: valuesResult };
}

export async function analyzeSheetText(rawInput: unknown): Promise<SemanticResult> {
  if (!(await requireAuth())) return { kind: "error", message: "Phiên đăng nhập đã hết hạn." };

  if (!rawInput || typeof rawInput !== "object") {
    return { kind: "error", message: "Dữ liệu không hợp lệ." };
  }

  const input = rawInput as Record<string, unknown>;
  const text = typeof input.text === "string" ? input.text.trim() : "";

  if (!text) return { kind: "error", message: "Không có nội dung để phân tích." };
  if (text.length > 50_000) return { kind: "error", message: "Nội dung quá dài." };

  const provider = new GeminiFlashcardGenerationProvider();
  try {
    const aiCards = await semanticSheetToCards(text, provider);
    const validation = validateDraftCards(aiCards.slice(0, IMPORT_MAX_ROWS));
    return {
      kind: "success",
      cards: validation.cards,
      valid: validation.valid,
      blank: validation.blank,
      partial: validation.partial,
      duplicate: validation.duplicate,
      aiUsed: true,
    };
  } catch {
    return { kind: "error", message: "Không thể phân tích nội dung bảng tính bằng AI." };
  }
}
