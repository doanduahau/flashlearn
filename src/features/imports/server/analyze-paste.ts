"use server";

import type { DraftFlashcard } from "@/features/imports/types/import-types";
import { validateDraftCards } from "@/features/imports/utils/validate-draft-cards";
import { parsePaste } from "@/features/imports/utils/parse-paste";
import { getEffectivePlan } from "@/features/entitlements/server/entitlement-service";
import { runMeteredFlashcardGeneration } from "@/features/entitlements/server/metered-ai-generation";
import { IMPORT_REQUEST_LIMITS, storagePlanTier } from "@/features/entitlements/storage-limits";
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

export async function analyzePasteContent(rawInput: unknown): Promise<AnalyzeResult> {
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

  const rawText =
    typeof rawInput === "string"
      ? rawInput
      : rawInput && typeof rawInput === "object" && "text" in rawInput
        ? (rawInput as { text?: unknown }).text
        : null;
  const idempotencyKey =
    rawInput && typeof rawInput === "object" && "idempotencyKey" in rawInput
      ? (rawInput as { idempotencyKey?: unknown }).idempotencyKey
      : null;

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

  const userId = claims.claims.sub;
  if (typeof userId !== "string") return { error: "Phiên đăng nhập đã hết hạn." };
  const plan = await getEffectivePlan(userId);
  const tier = storagePlanTier(plan);
  const parsedPaste = parsePaste(trimmed);
  const source = parsedPaste.kind === "structured" ? "paste_structured" : "paste_prose";
  const limits = IMPORT_REQUEST_LIMITS[source][tier];

  if (limits.sourceChars !== undefined && trimmed.length > limits.sourceChars) {
    recordImportTelemetry({
      correlationId,
      source: "paste",
      outcome: "rejected",
      processingPath: "not_applicable",
      inputSize: trimmed.length,
    });
    return {
      error: `Nội dung dán tối đa ${limits.sourceChars.toLocaleString("vi-VN")} ký tự với gói hiện tại.`,
    };
  }

  if (parsedPaste.kind === "structured") {
    const validation = validateDraftCards(parsedPaste.cards.slice(0, limits.cards));
    recordImportTelemetry({
      correlationId,
      source: "paste",
      outcome: "succeeded",
      processingPath: "deterministic",
      inputSize: trimmed.length,
      outputCount: validation.cards.length,
    });
    return { ...validation, cards: validation.cards, aiUsed: false };
  }

  if (typeof idempotencyKey !== "string" || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(idempotencyKey)) {
    return { error: "Mã tác vụ không hợp lệ. Vui lòng thử lại." };
  }

  let result;
  try {
    const generated = await runMeteredFlashcardGeneration({
      userId,
      kind: "paste_generate",
      source: "paste_prose",
      text: trimmed,
      maximumCards: limits.cards,
      idempotencyKey,
      correlationId,
    });
    result = { kind: "success" as const, cards: generated.cards, aiUsed: true };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Không thể phân tích nội dung. Vui lòng thử lại.",
    };
  }

  try {
    const validation = validateDraftCards(result.cards.slice(0, limits.cards));
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
