"use server";

import type { ExtractedDocument } from "@/features/imports/types/document-types";
import { extractDocx } from "@/features/imports/adapters/docx-adapter";
import {
  extractPdf,
  PDFEncryptedError,
  PdfProcessingError,
} from "@/features/imports/adapters/pdf-adapter";
import { validateDocumentFile } from "@/features/imports/utils/document-validation";
import { DOCUMENT_MAX_BYTES, DOCUMENT_MAX_EXTRACTED_CHARS } from "@/lib/constants";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";

type ExtractResult = { document: ExtractedDocument } | { error: string };

function safeErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("code" in error)) return undefined;
  const code = (error as { code?: unknown }).code;
  if (typeof code !== "string") return undefined;
  return /^[A-Z0-9_-]{1,64}$/i.test(code) ? code : undefined;
}

function pdfErrorCategory(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (/napi-rs\/canvas|canvas/i.test(message)) return "canvas_runtime_unavailable";
  if (/DOMMatrix|ImageData|Path2D/i.test(message)) return "dom_runtime_unavailable";
  if (/worker/i.test(message)) return "worker_runtime_failure";
  if (/invalid pdf|malformed|xref|pdf structure/i.test(message)) return "invalid_pdf_input";
  return "unclassified";
}

function safePdfErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (/Cannot find module ['"]@napi-rs\/canvas/i.test(message)) {
    return "Cannot find module '@napi-rs/canvas'";
  }
  if (/Cannot load.*@napi-rs\/canvas/i.test(message)) {
    return "Cannot load '@napi-rs/canvas'";
  }
  if (/DOMMatrix is not defined/i.test(message)) return "DOMMatrix is not defined";
  if (/ImageData is not defined/i.test(message)) return "ImageData is not defined";
  if (/Path2D is not defined/i.test(message)) return "Path2D is not defined";
  if (/Failed to load external module pdf-parse/i.test(message)) {
    return "Failed to load external module pdf-parse";
  }
  if (/worker/i.test(message)) return "PDF worker initialization failed";
  if (/invalid pdf|malformed|xref|pdf structure/i.test(message)) return "Invalid PDF input";
  return "Unclassified PDF runtime error";
}

function safePdfStackModules(error: unknown): string[] {
  const stack = error instanceof Error ? error.stack : undefined;
  if (!stack) return [];

  return Array.from(
    new Set(
      Array.from(
        stack.matchAll(/@napi-rs\/canvas|pdf-parse|pdfjs-dist|node:[a-z_/-]+/gi),
        (match) => match[0].toLowerCase(),
      ),
    ),
  ).slice(0, 8);
}

function logPdfProcessingFailure(error: unknown, fileSizeBytes: number): void {
  const processingError = error instanceof PdfProcessingError ? error : undefined;
  const originalError = processingError?.originalError ?? error;

  logger.error("pdf extraction failed", {
    stage: processingError?.stage ?? "pdf.unclassified",
    category: pdfErrorCategory(originalError),
    errorName: originalError instanceof Error ? originalError.name : "NonErrorThrown",
    errorCode: safeErrorCode(originalError),
    errorMessage: safePdfErrorMessage(originalError),
    stackModules: safePdfStackModules(originalError),
    workerConfigured: processingError?.workerConfigured,
    fileSizeBytes,
    runtime: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
    },
  });
}

export async function extractDocument(formData: FormData): Promise<ExtractResult> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return { error: "Phiên đăng nhập đã hết hạn." };

  const file = formData.get("file");
  if (!file || !(file instanceof File)) return { error: "Vui lòng chọn tệp." };

  if (file.size === 0) return { error: "Tệp trống." };
  if (file.size > DOCUMENT_MAX_BYTES) {
    return {
      error: `Tệp quá lớn. Kích thước tối đa là ${Math.round(DOCUMENT_MAX_BYTES / (1024 * 1024))} MB.`,
    };
  }

  const validation = validateDocumentFile({
    name: file.name,
    type: file.type,
    size: file.size,
  });

  if (!validation.ok) return { error: validation.error };

  const buffer = await file.arrayBuffer();

  let document: ExtractedDocument;

  try {
    if (validation.sourceType === "docx") {
      document = await extractDocx(buffer);
    } else {
      document = await extractPdf(buffer);
    }
  } catch (err) {
    if (err instanceof PDFEncryptedError) {
      return {
        error: "PDF này được bảo vệ bằng mật khẩu. FlashLearn chưa hỗ trợ mở PDF có mật khẩu.",
      };
    }
    if (validation.sourceType === "pdf") {
      logPdfProcessingFailure(err, file.size);
    }
    return { error: "Không thể đọc tệp này. Hãy kiểm tra tệp chưa bị hỏng." };
  }

  if (document.totalCharacters > DOCUMENT_MAX_EXTRACTED_CHARS) {
    return { error: "Nội dung tài liệu quá dài để xử lý." };
  }

  if (
    document.sourceType === "pdf" &&
    document.blocks.length === 0 &&
    (document.pageCount ?? 0) > 0
  ) {
    return {
      error: "PDF này không có văn bản có thể đọc. FlashLearn hiện chưa hỗ trợ PDF scan/ảnh.",
    };
  }

  return { document };
}
