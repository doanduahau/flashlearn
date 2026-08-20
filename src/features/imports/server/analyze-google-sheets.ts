"use server";

import type { DraftFlashcard } from "@/features/imports/types/import-types";
import type { GoogleSheetMeta, SheetData } from "@/features/imports/adapters/google-sheets-adapter";
import { runMeteredFlashcardGeneration } from "@/features/entitlements/server/metered-ai-generation";
import { getEffectivePlan } from "@/features/entitlements/server/entitlement-service";
import { IMPORT_REQUEST_LIMITS, storagePlanTier } from "@/features/entitlements/storage-limits";
import { validateDraftCards } from "@/features/imports/utils/validate-draft-cards";
import { buildDataColumnRange, buildHeaderScanRange } from "@/features/imports/utils/sheets-a1";
import {
  parseColumnBodies,
  parseHeaderScan,
  parseSpreadsheetMeta,
} from "@/features/imports/utils/sheets-parser";
import { GOOGLE_SHEETS_HEADER_SCAN_MAX_COLUMNS, IMPORT_MAX_ROWS } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { fetchWithTimeout } from "@/lib/resilience";
import { consumeRateLimit, rateLimitMessage, subjectRateLimitKey } from "@/lib/security/rate-limit";
import { logger } from "@/lib/logger";

const SHEETS_API_BASE = "https://sheets.googleapis.com/v4/spreadsheets";

type SheetOpenResult =
  | { kind: "success"; meta: GoogleSheetMeta; headers: string[]; sheetTitle: string }
  | { kind: "auth_required"; message: string }
  | { kind: "error"; message: string; status?: number; detail?: string };

type SheetValuesResult =
  | { kind: "success"; sheetData: SheetData }
  | { kind: "auth_required"; message: string }
  | { kind: "error"; message: string; status?: number; detail?: string };

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

async function requireAuth(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { data: claims } = await supabase.auth.getClaims();
    const userId = claims?.claims?.sub;
    return typeof userId === "string" ? userId : claims?.claims ? "authenticated" : null;
  } catch {
    return null;
  }
}

async function requireGoogleSheetsLimit(): Promise<{ userId: string } | { error: string }> {
  const userId = await requireAuth();
  if (!userId) return { error: "Phiên đăng nhập đã hết hạn." };
  const rateLimit = await consumeRateLimit(
    "googleSheets",
    subjectRateLimitKey("google-sheets", userId),
  );
  if (!rateLimit.ok) return { error: rateLimitMessage(rateLimit) };
  return { userId };
}

function authHeaders(accessToken: string): Record<string, string> {
  return { Accept: "application/json", Authorization: `Bearer ${accessToken}` };
}

async function fetchErrorDetail(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: { message?: string } };
    return body.error?.message ?? "";
  } catch {
    return "";
  }
}

async function logSheetApiError(res: Response, detail: string): Promise<void> {
  // Log only the HTTP status and Google's message — never the sheet id, token
  // or cell contents (avoid sensitive data in server logs).
  logger.warn("google_sheets.api_error", { status: res.status, detail });
}

async function fetchSheetMetadata(
  spreadsheetId: string,
  accessToken: string,
): Promise<GoogleSheetMeta | { error: string; status: number; detail?: string }> {
  const metaUrl = `${SHEETS_API_BASE}/${spreadsheetId}?fields=properties.title,sheets.properties(sheetId,title,index)`;
  const metaRes = await fetchWithTimeout("google-sheets", metaUrl, {
    headers: authHeaders(accessToken),
  });
  if (!metaRes.ok) {
    const detail = await fetchErrorDetail(metaRes);
    if (metaRes.status === 401 || metaRes.status === 403) {
      await logSheetApiError(metaRes, detail);
      return { error: "Permission denied.", status: metaRes.status, detail };
    }
    await logSheetApiError(metaRes, detail);
    return { error: "Không thể đọc bảng tính.", status: metaRes.status, detail };
  }
  return parseSpreadsheetMeta(await metaRes.json());
}

async function fetchHeaderScan(
  spreadsheetId: string,
  sheetTitle: string,
  accessToken: string,
): Promise<string[] | { error: string; status: number; detail?: string }> {
  const range = buildHeaderScanRange(sheetTitle, GOOGLE_SHEETS_HEADER_SCAN_MAX_COLUMNS);
  const url = `${SHEETS_API_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}`;
  const res = await fetchWithTimeout("google-sheets", url, { headers: authHeaders(accessToken) });
  if (!res.ok) {
    const detail = await fetchErrorDetail(res);
    if (res.status === 401 || res.status === 403) {
      await logSheetApiError(res, detail);
      return { error: "Permission denied.", status: res.status, detail };
    }
    await logSheetApiError(res, detail);
    return { error: "Không thể đọc bảng tính.", status: res.status, detail };
  }
  return parseHeaderScan(await res.json());
}

async function fetchColumnBodies(
  spreadsheetId: string,
  sheetTitle: string,
  columns: number[],
  accessToken: string,
): Promise<SheetData | { error: string; status: number; detail?: string }> {
  const ranges = columns.map((col) => buildDataColumnRange(sheetTitle, col, IMPORT_MAX_ROWS));
  const rangesParam = ranges.map((r) => `ranges=${encodeURIComponent(r)}`).join("&");
  const url = `${SHEETS_API_BASE}/${spreadsheetId}/values:batchGet?${rangesParam}&majorDimension=ROWS`;
  const res = await fetchWithTimeout("google-sheets", url, { headers: authHeaders(accessToken) });
  if (!res.ok) {
    const detail = await fetchErrorDetail(res);
    if (res.status === 401 || res.status === 403) {
      await logSheetApiError(res, detail);
      return { error: "Permission denied.", status: res.status, detail };
    }
    await logSheetApiError(res, detail);
    return { error: "Không thể đọc dữ liệu bảng tính.", status: res.status, detail };
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
  const access = await requireGoogleSheetsLimit();
  if ("error" in access) return { kind: "error", message: access.error };

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
      : {
          kind: "error",
          message: metaResult.error,
          status: metaResult.status,
          detail: metaResult.detail,
        };
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
      : {
          kind: "error",
          message: headerResult.error,
          status: headerResult.status,
          detail: headerResult.detail,
        };
  }

  return { kind: "success", meta: metaResult, headers: headerResult, sheetTitle: sheet.title };
}

export async function discoverPrivateSheetHeaders(rawInput: unknown): Promise<SheetOpenResult> {
  const access = await requireGoogleSheetsLimit();
  if ("error" in access) return { kind: "error", message: access.error };

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
      : {
          kind: "error",
          message: headerResult.error,
          status: headerResult.status,
          detail: headerResult.detail,
        };
  }

  return {
    kind: "success",
    meta: { spreadsheetTitle: sheetTitle, sheets: [] },
    headers: headerResult,
    sheetTitle,
  };
}

export async function loadPrivateSheetValues(rawInput: unknown): Promise<SheetValuesResult> {
  const access = await requireGoogleSheetsLimit();
  if ("error" in access) return { kind: "error", message: access.error };

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
  if (columns.length === 0 || columns.length > 26)
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
      : {
          kind: "error",
          message: valuesResult.error,
          status: valuesResult.status,
          detail: valuesResult.detail,
        };
  }

  return { kind: "success", sheetData: valuesResult };
}

export async function analyzeSheetText(rawInput: unknown): Promise<SemanticResult> {
  const access = await requireGoogleSheetsLimit();
  if ("error" in access) return { kind: "error", message: access.error };

  if (!rawInput || typeof rawInput !== "object") {
    return { kind: "error", message: "Dữ liệu không hợp lệ." };
  }

  const input = rawInput as Record<string, unknown>;
  const text = typeof input.text === "string" ? input.text.trim() : "";
  const idempotencyKey =
    typeof input.idempotencyKey === "string" ? input.idempotencyKey.trim() : "";

  if (!text) return { kind: "error", message: "Không có nội dung để phân tích." };
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(idempotencyKey)) {
    return { kind: "error", message: "Mã tác vụ không hợp lệ. Vui lòng thử lại." };
  }
  const plan = await getEffectivePlan(access.userId);
  const limits = IMPORT_REQUEST_LIMITS.paste_prose[storagePlanTier(plan)];
  if (limits.sourceChars !== undefined && text.length > limits.sourceChars) {
    return {
      kind: "error",
      message: `Nội dung tối đa ${limits.sourceChars.toLocaleString("vi-VN")} ký tự với gói hiện tại.`,
    };
  }

  try {
    const generated = await runMeteredFlashcardGeneration({
      userId: access.userId,
      kind: "google_sheets_generate",
      source: "google_sheets_semantic",
      text,
      maximumCards: limits.cards,
      idempotencyKey,
      correlationId: crypto.randomUUID(),
    });
    const validation = validateDraftCards(generated.cards.slice(0, limits.cards));
    return {
      kind: "success",
      cards: validation.cards,
      valid: validation.valid,
      blank: validation.blank,
      partial: validation.partial,
      duplicate: validation.duplicate,
      aiUsed: true,
    };
  } catch (error) {
    return {
      kind: "error",
      message:
        error instanceof Error ? error.message : "Không thể phân tích nội dung bảng tính bằng AI.",
    };
  }
}
