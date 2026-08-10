"use server";

import type { DraftFlashcard } from "@/features/imports/types/import-types";
import { GeminiFlashcardGenerationProvider } from "@/features/imports/adapters/gemini-provider";
import { semanticSheetToCards } from "@/features/imports/adapters/google-sheets-adapter";
import type { GoogleSheetMeta, SheetData } from "@/features/imports/adapters/google-sheets-adapter";
import { validateDraftCards } from "@/features/imports/utils/validate-draft-cards";
import { buildA1Range } from "@/features/imports/utils/sheets-a1";
import { GOOGLE_SHEETS_MAX_COLUMNS, IMPORT_MAX_ROWS } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";

const SHEETS_API_BASE = "https://sheets.googleapis.com/v4/spreadsheets";

type SheetFetchResult =
  | { kind: "success"; meta: GoogleSheetMeta; sheetData: SheetData }
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

function parseSpreadsheetMeta(json: unknown): GoogleSheetMeta {
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

function parseSheetValues(json: unknown, sheetTitle: string): SheetData {
  const values = (json as { values?: unknown }).values;
  const rows: string[][] = Array.isArray(values)
    ? (values as unknown[][]).map((row) => (Array.isArray(row) ? row.map(String) : []))
    : [];
  const limited = rows.slice(0, IMPORT_MAX_ROWS + 1);
  const headers = (limited[0] ?? []).map((cell) => String(cell ?? ""));
  const dataRows = limited.slice(1);
  return { headers, rows: dataRows, rowCount: Math.max(0, rows.length - 1) };
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

async function fetchSheetValues(
  spreadsheetId: string,
  sheetTitle: string,
  accessToken: string,
): Promise<SheetData | { error: string; status: number }> {
  const range = buildA1Range(sheetTitle, IMPORT_MAX_ROWS + 1, GOOGLE_SHEETS_MAX_COLUMNS);
  const valuesUrl = `${SHEETS_API_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}?majorDimension=ROWS`;
  const valuesRes = await fetch(valuesUrl, { headers: authHeaders(accessToken) });
  if (!valuesRes.ok) {
    if (valuesRes.status === 401 || valuesRes.status === 403)
      return { error: "Permission denied.", status: valuesRes.status };
    return { error: "Không thể đọc dữ liệu bảng tính.", status: valuesRes.status };
  }
  return parseSheetValues(await valuesRes.json(), sheetTitle);
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

export async function openGoogleSheet(rawInput: unknown): Promise<SheetFetchResult> {
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

  const valuesResult = await fetchSheetValues(spreadsheetId, sheet.title, accessToken);
  if ("error" in valuesResult) {
    return valuesResult.status === 401 || valuesResult.status === 403
      ? {
          kind: "auth_required",
          message: "Bảng tính này cần quyền truy cập. Hãy chọn bảng tính từ Google Drive.",
        }
      : { kind: "error", message: valuesResult.error };
  }

  return { kind: "success", meta: metaResult, sheetData: valuesResult };
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

  if (!spreadsheetId || spreadsheetId.length < 30)
    return { kind: "error", message: "Liên kết Google Sheets không hợp lệ." };
  if (!sheetTitle) return { kind: "error", message: "Sheet không hợp lệ." };
  if (!accessToken) {
    return {
      kind: "auth_required",
      message: "Bảng tính này cần quyền truy cập. Hãy chọn bảng tính từ Google Drive.",
    };
  }

  const valuesResult = await fetchSheetValues(spreadsheetId, sheetTitle, accessToken);
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
