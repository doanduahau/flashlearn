"use server";

import type { DraftFlashcard } from "@/features/imports/types/import-types";
import { GeminiFlashcardGenerationProvider } from "@/features/imports/adapters/gemini-provider";
import {
  adaptSheetData,
  semanticSheetToCards,
  type GoogleSheetMeta,
  type SheetData,
  type GoogleSheetsAdapterResult,
} from "@/features/imports/adapters/google-sheets-adapter";
import { extractSpreadsheetId } from "@/features/imports/utils/extract-spreadsheet-id";
import { validateDraftCards } from "@/features/imports/utils/validate-draft-cards";
import { IMPORT_MAX_ROWS } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";

const SHEETS_API_BASE = "https://sheets.googleapis.com/v4/spreadsheets";

type SheetsOpenResult =
  | {
      kind: "success";
      meta: GoogleSheetMeta;
      sheetData: SheetData;
      analysis: GoogleSheetsAdapterResult;
    }
  | { kind: "auth_required"; message: string }
  | { kind: "error"; message: string };

async function fetchSpreadsheet(
  spreadsheetId: string,
  sheetIndex: number,
  accessToken?: string,
): Promise<{ meta: GoogleSheetMeta; sheetData: SheetData } | { error: string; status: number }> {
  const apiKey = accessToken ? undefined : process.env.NEXT_PUBLIC_GOOGLE_PICKER_API_KEY;
  const fetchHeaders: Record<string, string> = { Accept: "application/json" };
  if (accessToken) fetchHeaders.Authorization = `Bearer ${accessToken}`;
  const keyParam = apiKey ? `?key=${apiKey}` : "";
  const baseUrl = `${SHEETS_API_BASE}/${spreadsheetId}${keyParam}`;
  const metaUrl = `${baseUrl}${apiKey ? "&" : "?"}fields=properties.title,sheets.properties(sheetId,title,index)`;

  const metaRes = await fetch(metaUrl, { headers: fetchHeaders });

  if (!metaRes.ok) {
    if (metaRes.status === 401 || metaRes.status === 403) {
      return { error: "Permission denied.", status: metaRes.status };
    }
    return { error: "Không thể đọc bảng tính.", status: metaRes.status };
  }

  const metaJson = await metaRes.json();

  const title: string = metaJson.properties?.title ?? "Google Sheets";
  const sheets: GoogleSheetMeta["sheets"] = [];

  for (const s of metaJson.sheets ?? []) {
    const p = s.properties ?? {};
    sheets.push({
      title: p.title ?? `Sheet ${sheets.length + 1}`,
      sheetId: p.sheetId ?? sheets.length,
      index: p.index ?? sheets.length,
    });
  }

  const selected = sheets[sheetIndex];
  if (!selected) {
    return { error: "Sheet không tồn tại.", status: 404 };
  }

  const valuesUrl = `${baseUrl}/values/${encodeURIComponent(selected.title)}${apiKey ? (baseUrl.includes("?") ? "&" : "?") : ""}majorDimension=ROWS`;
  const valuesRes = await fetch(valuesUrl, { headers: fetchHeaders });

  if (!valuesRes.ok) {
    return { error: "Không thể đọc dữ liệu bảng tính.", status: valuesRes.status };
  }

  const valuesJson = await valuesRes.json();
  const allRows: string[][] = (valuesJson.values ?? []) as string[][];
  const limitedRows = allRows.slice(0, IMPORT_MAX_ROWS + 1);
  const headers = (limitedRows[0] ?? []).map((cell) => String(cell ?? ""));
  const dataRows = limitedRows.slice(1);

  return {
    meta: { spreadsheetTitle: title, sheets },
    sheetData: { headers, rows: dataRows, rowCount: allRows.length - 1 },
  };
}

export async function openGoogleSheet(rawInput: unknown): Promise<SheetsOpenResult> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return { kind: "error", message: "Phiên đăng nhập đã hết hạn." };

  if (!rawInput || typeof rawInput !== "object") {
    return { kind: "error", message: "Dữ liệu không hợp lệ." };
  }

  const input = rawInput as Record<string, unknown>;
  const spreadsheetId = typeof input.spreadsheetId === "string" ? input.spreadsheetId.trim() : "";
  const accessToken = typeof input.accessToken === "string" ? input.accessToken : undefined;
  const sheetIndex =
    typeof input.sheetIndex === "number" &&
    Number.isFinite(input.sheetIndex) &&
    input.sheetIndex >= 0
      ? Math.floor(input.sheetIndex as number)
      : 0;

  if (!spreadsheetId || spreadsheetId.length < 30) {
    return { kind: "error", message: "Liên kết Google Sheets không hợp lệ." };
  }

  const fetchResult = await fetchSpreadsheet(spreadsheetId, sheetIndex, accessToken);

  if ("error" in fetchResult) {
    if (fetchResult.status === 401 || fetchResult.status === 403) {
      return {
        kind: "auth_required",
        message: "Bảng tính này cần quyền truy cập. Hãy chọn bảng tính từ Google Drive.",
      };
    }
    return { kind: "error", message: fetchResult.error };
  }

  const analysis = adaptSheetData(fetchResult.sheetData);
  return {
    kind: "success",
    meta: fetchResult.meta,
    sheetData: fetchResult.sheetData,
    analysis,
  };
}

type SheetsAnalyzeResult =
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

export async function analyzeGoogleSheetContent(rawInput: unknown): Promise<SheetsAnalyzeResult> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return { kind: "error", message: "Phiên đăng nhập đã hết hạn." };

  if (!rawInput || typeof rawInput !== "object") {
    return { kind: "error", message: "Dữ liệu không hợp lệ." };
  }

  const input = rawInput as Record<string, unknown>;
  const spreadsheetId = typeof input.spreadsheetId === "string" ? input.spreadsheetId.trim() : "";
  const accessToken = typeof input.accessToken === "string" ? input.accessToken : undefined;
  const sheetIndex =
    typeof input.sheetIndex === "number" &&
    Number.isFinite(input.sheetIndex) &&
    input.sheetIndex >= 0
      ? Math.floor(input.sheetIndex as number)
      : 0;

  let frontColumn: number | undefined;
  let backColumn: number | undefined;
  if (
    typeof input.frontColumn === "number" &&
    Number.isFinite(input.frontColumn) &&
    input.frontColumn >= 0
  ) {
    frontColumn = Math.floor(input.frontColumn as number);
  }
  if (
    typeof input.backColumn === "number" &&
    Number.isFinite(input.backColumn) &&
    input.backColumn >= 0
  ) {
    backColumn = Math.floor(input.backColumn as number);
  }

  if (!spreadsheetId || spreadsheetId.length < 30) {
    return { kind: "error", message: "Liên kết Google Sheets không hợp lệ." };
  }

  const fetchResult = await fetchSpreadsheet(spreadsheetId, sheetIndex, accessToken);

  if ("error" in fetchResult) {
    return { kind: "error", message: fetchResult.error };
  }

  const preferredMapping =
    frontColumn !== undefined && backColumn !== undefined ? { frontColumn, backColumn } : undefined;

  const analysis = adaptSheetData(fetchResult.sheetData, preferredMapping);

  if (analysis.kind === "error") {
    return { kind: "error", message: analysis.message };
  }

  if (analysis.kind === "needs_mapping") {
    return { kind: "error", message: "Vui lòng chọn cột mặt trước và mặt sau." };
  }

  if (analysis.kind === "single_column_semantic") {
    const provider = new GeminiFlashcardGenerationProvider();
    try {
      const aiCards = await semanticSheetToCards(analysis.text, provider);
      const trimmed = aiCards.slice(0, IMPORT_MAX_ROWS);
      const validation = validateDraftCards(trimmed);
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
      return {
        kind: "error",
        message: "Không thể phân tích nội dung bảng tính bằng AI.",
      };
    }
  }

  const trimmed = analysis.cards.slice(0, IMPORT_MAX_ROWS);
  try {
    const validation = validateDraftCards(trimmed);
    return {
      kind: "success",
      cards: validation.cards,
      valid: validation.valid,
      blank: validation.blank,
      partial: validation.partial,
      duplicate: validation.duplicate,
      aiUsed: false,
    };
  } catch (err) {
    return { kind: "error", message: err instanceof Error ? err.message : "Dữ liệu không hợp lệ." };
  }
}

export async function openGoogleSheetUrl(rawInput: unknown): Promise<SheetsOpenResult> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return { kind: "error", message: "Phiên đăng nhập đã hết hạn." };

  if (!rawInput || typeof rawInput !== "object") {
    return { kind: "error", message: "Dữ liệu không hợp lệ." };
  }

  const input = rawInput as Record<string, unknown>;
  const url = typeof input.url === "string" ? input.url : "";

  if (!url) {
    return { kind: "error", message: "Vui lòng dán liên kết Google Sheets." };
  }

  const spreadsheetId = extractSpreadsheetId(url);
  if (!spreadsheetId) {
    return { kind: "error", message: "Liên kết Google Sheets không hợp lệ." };
  }

  const result = await fetchSpreadsheet(spreadsheetId, 0, undefined);

  if ("error" in result) {
    if (result.status === 401 || result.status === 403) {
      return {
        kind: "auth_required",
        message: "Bảng tính này cần quyền truy cập. Hãy chọn bảng tính từ Google Drive.",
      };
    }
    return { kind: "error", message: result.error };
  }

  const analysis = adaptSheetData(result.sheetData);
  return {
    kind: "success",
    meta: result.meta,
    sheetData: result.sheetData,
    analysis,
  };
}
