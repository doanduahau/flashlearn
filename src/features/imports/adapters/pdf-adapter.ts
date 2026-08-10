import type { ExtractedDocument, ExtractedDocumentBlock } from "../types/document-types";
import { DOCUMENT_MAX_EXTRACTED_CHARS, PDF_MAX_PAGES } from "@/lib/constants";

import { PDFParse, PasswordException } from "pdf-parse";

function detectScanOnly(pageTexts: string[]): boolean {
  if (pageTexts.length === 0) return true;
  return pageTexts.every((p) => p.replace(/\s/g, "").length < 10);
}

export async function extractPdf(fileBuffer: ArrayBuffer): Promise<ExtractedDocument> {
  const data = new Uint8Array(fileBuffer);
  const parser = new PDFParse({ data, verbosity: 0 });

  let info;
  let textResult;
  try {
    info = await parser.getInfo();
    textResult = await parser.getText({ first: PDF_MAX_PAGES });
  } catch (err) {
    if (err instanceof PasswordException) {
      await parser.destroy();
      throw new PDFEncryptedError();
    }
    await parser.destroy();
    throw err;
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
    await parser.destroy();
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

  await parser.destroy();

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
