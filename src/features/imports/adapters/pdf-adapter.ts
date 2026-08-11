import type { ExtractedDocument, ExtractedDocumentBlock } from "../types/document-types";
import { DOCUMENT_MAX_EXTRACTED_CHARS, PDF_MAX_PAGES } from "@/lib/constants";

type PdfRuntime = typeof import("pdf-parse");
type PdfWorkerRuntime = typeof import("pdf-parse/worker");

export type PdfProcessingStage =
  "pdf.runtime_import" | "pdf.parser_construct" | "pdf.document_load" | "pdf.text_extract";

/**
 * Carries a stage to the server action without exposing the underlying runtime
 * error to the browser. The action turns this into a safe, metadata-only log.
 */
export class PdfProcessingError extends Error {
  readonly originalError: unknown;
  readonly workerConfigured: boolean | undefined;

  constructor(
    readonly stage: PdfProcessingStage,
    originalError: unknown,
    options?: { workerConfigured?: boolean },
  ) {
    super("PDF_PROCESSING_FAILED");
    this.name = "PdfProcessingError";
    this.originalError = originalError;
    this.workerConfigured = options?.workerConfigured;
  }
}

type PdfRuntimeLoad = {
  runtime: PdfRuntime;
  workerConfigured: boolean;
};

// `extract-document` is registered with /sets for every import mode. Keep this
// runtime import inside PDF extraction so pdfjs-dist's optional rendering
// dependencies are never evaluated for Manual, Excel, Paste, Sheets, or DOCX.
// pdf-parse remains external so its worker can be resolved from disk only here.
async function loadPdfRuntime(): Promise<PdfRuntimeLoad> {
  let pdfRuntime: PdfRuntime;
  try {
    pdfRuntime = await import("pdf-parse");
  } catch (error) {
    throw new PdfProcessingError("pdf.runtime_import", error);
  }

  return {
    runtime: pdfRuntime,
    workerConfigured: await configurePdfWorker(pdfRuntime.PDFParse),
  };
}

async function configurePdfWorker(PDFParse: PdfRuntime["PDFParse"]): Promise<boolean> {
  try {
    const workerRuntime: PdfWorkerRuntime = await import("pdf-parse/worker");
    PDFParse.setWorker(workerRuntime.getData());
    return true;
  } catch {
    // Keep the parser's native fallback, and expose the failed configuration in
    // the safe server-side diagnostic if document loading also fails.
    return false;
  }
}

async function destroyParser(parser: { destroy: () => Promise<void> }): Promise<void> {
  try {
    await parser.destroy();
  } catch {
    // Preserve the original parser failure for safe diagnostic classification.
  }
}

function detectScanOnly(pageTexts: string[]): boolean {
  if (pageTexts.length === 0) return true;
  return pageTexts.every((p) => p.replace(/\s/g, "").length < 10);
}

export async function extractPdf(fileBuffer: ArrayBuffer): Promise<ExtractedDocument> {
  const { runtime, workerConfigured } = await loadPdfRuntime();
  const { PDFParse, PasswordException } = runtime;
  const data = new Uint8Array(fileBuffer);
  let parser: InstanceType<PdfRuntime["PDFParse"]>;
  try {
    parser = new PDFParse({ data, verbosity: 0 });
  } catch (error) {
    throw new PdfProcessingError("pdf.parser_construct", error, { workerConfigured });
  }

  let info;
  let textResult;
  try {
    info = await parser.getInfo();
  } catch (err) {
    if (err instanceof PasswordException) {
      await destroyParser(parser);
      throw new PDFEncryptedError();
    }
    await destroyParser(parser);
    throw new PdfProcessingError("pdf.document_load", err, { workerConfigured });
  }

  try {
    textResult = await parser.getText({ first: PDF_MAX_PAGES });
  } catch (err) {
    if (err instanceof PasswordException) {
      await destroyParser(parser);
      throw new PDFEncryptedError();
    }
    await destroyParser(parser);
    throw new PdfProcessingError("pdf.text_extract", err, { workerConfigured });
  }

  const pages = textResult.pages ?? [];
  const pageTexts: string[] = [];
  for (const page of pages) {
    const t = (page.text ?? "").replace(/\s+/g, " ").trim();
    pageTexts.push(t);
  }

  const isScanOnly = detectScanOnly(pageTexts);
  const pagesWithText = pageTexts.filter((p) => p.length > 0).length;

  if (isScanOnly) {
    await destroyParser(parser);
    return {
      sourceType: "pdf",
      title: info?.info?.Title,
      blocks: [],
      totalCharacters: 0,
      pageCount: pages.length || undefined,
      extractedPageCount: 0,
      pagesWithoutText: pages.length,
    };
  }

  const blocks: ExtractedDocumentBlock[] = [];
  let totalChars = 0;

  for (let i = 0; i < pageTexts.length; i++) {
    const pageText = pageTexts[i];
    if (!pageText) continue;
    const pageNum = i + 1;
    const paragraphs = pageText
      .split(/\n{2,}/)
      .map((p) => p.replace(/\n/g, " ").trim())
      .filter((p) => p.length > 0);

    for (const para of paragraphs) {
      blocks.push({ type: "paragraph", text: para, page: pageNum });
      totalChars += para.length;
      if (totalChars > DOCUMENT_MAX_EXTRACTED_CHARS) break;
    }
    if (totalChars > DOCUMENT_MAX_EXTRACTED_CHARS) break;
  }

  const pagesWithoutText = pages.length - pagesWithText;

  await destroyParser(parser);

  return {
    sourceType: "pdf",
    title: info?.info?.Title,
    blocks,
    totalCharacters: Math.min(totalChars, DOCUMENT_MAX_EXTRACTED_CHARS),
    pageCount: pages.length || undefined,
    extractedPageCount: pagesWithText,
    pagesWithoutText,
  };
}

export class PDFEncryptedError extends Error {
  constructor() {
    super("PDF_ENCRYPTED");
    this.name = "PDFEncryptedError";
  }
}
