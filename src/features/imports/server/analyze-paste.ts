"use server";

import type { DraftFlashcard } from "@/features/imports/types/import-types";
import { pasteToDraftCards } from "@/features/imports/adapters/paste-adapter";
import { GeminiFlashcardGenerationProvider } from "@/features/imports/adapters/gemini-provider";
import { validateDraftCards } from "@/features/imports/utils/validate-draft-cards";
import { IMPORT_MAX_ROWS, PASTE_MAX_CHARS } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { createTelemetryCorrelationId, recordImportTelemetry } from "@/lib/telemetry/telemetry";

type AnalyzeResult =
  | {
      cards: DraftFlashcard[];
      valid: number;
      blank: number;
      partial: number;
      duplicate: number;
      aiUsed: boolean;
    }
  | { error: string };

export async function analyzePasteContent(rawText: unknown): Promise<AnalyzeResult> {
  const correlationId = createTelemetryCorrelationId();
  let supabase;
  try {
    supabase = await createClient();
  } catch {
    recordImportTelemetry({
      correlationId,
      source: "paste",
      outcome: "failed",
      processingPath: "not_applicable",
      inputSize: 0,
    });
    return { error: "Không thể kết nối đến máy chủ. Vui lòng thử lại." };
  }

  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return { error: "Phiên đăng nhập đã hết hạn." };

  if (typeof rawText !== "string") {
    recordImportTelemetry({
      correlationId,
      source: "paste",
      outcome: "rejected",
      processingPath: "not_applicable",
      inputSize: 0,
    });
    return { error: "Dữ liệu không hợp lệ." };
  }

  const trimmed = rawText.trim();
  if (!trimmed) {
    recordImportTelemetry({
      correlationId,
      source: "paste",
      outcome: "rejected",
      processingPath: "not_applicable",
      inputSize: 0,
    });
    return { error: "Vui lòng dán nội dung." };
  }

  if (trimmed.length > PASTE_MAX_CHARS) {
    recordImportTelemetry({
      correlationId,
      source: "paste",
      outcome: "rejected",
      processingPath: "not_applicable",
      inputSize: trimmed.length,
    });
    return { error: `Nội dung dán tối đa ${PASTE_MAX_CHARS.toLocaleString("vi-VN")} ký tự.` };
  }

  const provider = new GeminiFlashcardGenerationProvider();
  const result = await pasteToDraftCards(trimmed, { provider });

  if (result.kind === "error") {
    recordImportTelemetry({
      correlationId,
      source: "paste",
      outcome: "failed",
      processingPath: "ai",
      inputSize: trimmed.length,
    });
    return { error: result.message };
  }

  try {
    const validation = validateDraftCards(result.cards.slice(0, IMPORT_MAX_ROWS));
    const response = {
      cards: validation.cards,
      valid: validation.valid,
      blank: validation.blank,
      partial: validation.partial,
      duplicate: validation.duplicate,
      aiUsed: result.aiUsed,
    };
    recordImportTelemetry({
      correlationId,
      source: "paste",
      outcome: "succeeded",
      processingPath: result.aiUsed ? "ai" : "deterministic",
      inputSize: trimmed.length,
      outputCount: response.cards.length,
    });
    return response;
  } catch (err) {
    recordImportTelemetry({
      correlationId,
      source: "paste",
      outcome: "failed",
      processingPath: result.aiUsed ? "ai" : "deterministic",
      inputSize: trimmed.length,
    });
    return { error: err instanceof Error ? err.message : "Dữ liệu không hợp lệ." };
  }
}
