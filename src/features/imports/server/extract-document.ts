"use server";

import type { ExtractedDocument } from "@/features/imports/types/document-types";
import { extractDocx } from "@/features/imports/adapters/docx-adapter";
import {
  extractPdf,
  PDFEncryptedError,
  PDFPageLimitError,
  PdfProcessingError,
} from "@/features/imports/adapters/pdf-adapter";
import { validateDocumentFile } from "@/features/imports/utils/document-validation";
import { inspectDocumentBytes } from "@/features/imports/utils/file-hardening";
import { aiPlanTier, DOCUMENT_PROCESSING_LIMITS } from "@/features/entitlements/ai-job-limits";
import {
  finalizeUsage,
  getEffectivePlan,
  refundUsage,
  reserveUsage,
} from "@/features/entitlements/server/entitlement-service";
import {
  finishProcessingJob,
  linkJobReservation,
  runProcessingJobPhase,
  startProcessingJob,
} from "@/features/entitlements/server/processing-job-service";
import { logger } from "@/lib/logger";
import { withTimeout } from "@/lib/resilience";
import { consumeRateLimit, rateLimitMessage, subjectRateLimitKey } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { createTelemetryCorrelationId, recordDocumentTelemetry } from "@/lib/telemetry/telemetry";

type ExtractResult = { document: ExtractedDocument } | { error: string };

function safeErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("code" in error)) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" && /^[A-Z0-9_-]{1,64}$/i.test(code) ? code : undefined;
}

function pdfErrorCategory(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (/napi-rs\/canvas|canvas/i.test(message)) return "canvas_runtime_unavailable";
  if (/DOMMatrix|ImageData|Path2D/i.test(message)) return "dom_runtime_unavailable";
  if (/worker/i.test(message)) return "worker_runtime_failure";
  if (/invalid pdf|malformed|xref|pdf structure/i.test(message)) return "invalid_pdf_input";
  return "unclassified";
}

function logPdfProcessingFailure(error: unknown, fileSizeBytes: number): void {
  const processingError = error instanceof PdfProcessingError ? error : undefined;
  const originalError = processingError?.originalError ?? error;
  logger.error("pdf extraction failed", {
    stage: processingError?.stage ?? "pdf.unclassified",
    category: pdfErrorCategory(originalError),
    errorName: originalError instanceof Error ? originalError.name : "NonErrorThrown",
    errorCode: safeErrorCode(originalError),
    workerConfigured: processingError?.workerConfigured,
    fileSizeBytes,
    runtime: { node: process.version, platform: process.platform, arch: process.arch },
  });
}

function validUuid(value: FormDataEntryValue | null): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value);
}

export async function extractDocument(formData: FormData): Promise<ExtractResult> {
  const correlationId = createTelemetryCorrelationId();
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (typeof userId !== "string") return { error: "Phiên đăng nhập đã hết hạn." };

  const file = formData.get("file");
  const idempotencyKey = formData.get("idempotencyKey");
  if (!file || !(file instanceof File)) return { error: "Vui lòng chọn tệp." };
  if (!validUuid(idempotencyKey)) return { error: "Mã tác vụ không hợp lệ. Vui lòng thử lại." };
  if (file.size === 0) return { error: "Tệp trống." };

  const validation = validateDocumentFile({ name: file.name, type: file.type, size: file.size });
  if (!validation.ok) return { error: validation.error };

  const plan = await getEffectivePlan(userId);
  const tier = aiPlanTier(plan);
  const limits = DOCUMENT_PROCESSING_LIMITS[validation.sourceType][tier];
  if (file.size > limits.bytes) {
    return {
      error: `Tệp tối đa ${Math.round(limits.bytes / (1024 * 1024))} MB với gói hiện tại.`,
    };
  }

  const buffer = await file.arrayBuffer();
  const hardened = inspectDocumentBytes(buffer, validation.sourceType, tier);
  if (!hardened.ok) {
    recordDocumentTelemetry({
      correlationId,
      operation: "extract",
      outcome: "rejected",
      processingPath: "deterministic",
      inputSize: file.size,
    });
    return { error: hardened.message };
  }

  const rateLimit = await consumeRateLimit(
    plan === "free" ? "aiGenerationFree" : "aiGenerationPro",
    subjectRateLimitKey("ai-heavy-start", userId),
  );
  if (!rateLimit.ok) return { error: rateLimitMessage(rateLimit) };

  let job;
  try {
    job = await startProcessingJob({
      userId,
      kind: "document_pipeline",
      source: validation.sourceType,
      idempotencyKey,
      correlationId,
    });
  } catch {
    return { error: "Không thể bắt đầu xử lý tài liệu. Vui lòng thử lại." };
  }
  if (job.replayed && !["queued", "running"].includes(job.status)) {
    return { error: "Tác vụ tài liệu này đã kết thúc. Hãy chọn lại tệp để tạo tác vụ mới." };
  }

  const reservations = [];
  for (const usageKey of [
    "documents.heavy_jobs.monthly",
    "documents.heavy_jobs.rolling_day",
  ] as const) {
    const reservation = await reserveUsage({
      userId,
      usageKey,
      requestedAmount: 1,
      idempotencyKey,
      correlationId,
    });
    if (reservation.wouldBlock && reservation.enforcementMode === "block") {
      for (const active of reservations) {
        if (active.status === "reserved") {
          await refundUsage(active.id, "paired_document_quota_denied").catch(() => undefined);
        }
      }
      await finishProcessingJob({
        jobId: job.id,
        userId,
        status: "cancelled",
        errorCode: "QUOTA_EXCEEDED",
      }).catch(() => undefined);
      return { error: "Bạn đã dùng hết lượt xử lý tài liệu của gói hiện tại." };
    }
    if (reservation.reservation_id) {
      const purpose = usageKey.endsWith("rolling_day") ? "heavy_rolling_day" : "heavy_monthly";
      await linkJobReservation({
        jobId: job.id,
        userId,
        reservationId: reservation.reservation_id,
        purpose,
      });
      reservations.push({
        id: reservation.reservation_id,
        status: reservation.reservation_status,
      });
    }
  }

  try {
    const document = await runProcessingJobPhase({ id: job.id, userId }, async () =>
      withTimeout(
        "document-parser",
        validation.sourceType === "docx"
          ? extractDocx(buffer)
          : extractPdf(buffer, "pages" in limits ? limits.pages : undefined),
        20_000,
      ),
    );

    if (document.totalCharacters > limits.characters) {
      throw new DocumentInputError(
        `Nội dung tài liệu tối đa ${limits.characters.toLocaleString("vi-VN")} ký tự với gói hiện tại.`,
      );
    }
    if (
      document.sourceType === "pdf" &&
      document.blocks.length === 0 &&
      (document.pageCount ?? 0) > 0
    ) {
      throw new DocumentInputError(
        "PDF này không có văn bản có thể đọc. CapyStudy hiện chưa hỗ trợ PDF scan/ảnh.",
      );
    }

    for (const reservation of reservations) {
      if (reservation.status === "reserved") await finalizeUsage(reservation.id, 1);
    }
    document.processingJob = { id: job.id, correlationId };
    recordDocumentTelemetry({
      correlationId,
      operation: "extract",
      outcome: "succeeded",
      processingPath: "deterministic",
      inputSize: file.size,
      outputCount: document.blocks.length,
    });
    return { document };
  } catch (error) {
    for (const reservation of reservations) {
      if (reservation.status === "reserved") {
        await refundUsage(reservation.id, "invalid_or_failed_document").catch(() => undefined);
      }
    }
    await finishProcessingJob({
      jobId: job.id,
      userId,
      status: "failed",
      errorCode: error instanceof DocumentInputError ? "DOCUMENT_LIMIT" : "DOCUMENT_PARSE_FAILED",
    }).catch(() => undefined);
    if (error instanceof PDFEncryptedError) {
      return { error: "PDF này được bảo vệ bằng mật khẩu. CapyStudy chưa hỗ trợ PDF có mật khẩu." };
    }
    if (error instanceof PDFPageLimitError) {
      return { error: `PDF tối đa ${error.maximumPages} trang với gói hiện tại.` };
    }
    if (error instanceof DocumentInputError) return { error: error.message };
    if (validation.sourceType === "pdf") logPdfProcessingFailure(error, file.size);
    recordDocumentTelemetry({
      correlationId,
      operation: "extract",
      outcome: "failed",
      processingPath: "deterministic",
      inputSize: file.size,
    });
    return { error: "Không thể đọc tệp này. Hãy kiểm tra tệp chưa bị hỏng." };
  }
}

class DocumentInputError extends Error {}
