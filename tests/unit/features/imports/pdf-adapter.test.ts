import { afterEach, describe, expect, it, vi } from "vitest";

const { mockPDFParseClass } = vi.hoisted(() => {
  const fn = vi.fn();
  return { mockPDFParseClass: fn };
});

vi.mock("pdf-parse", () => ({
  PDFParse: mockPDFParseClass,
  PasswordException: class extends Error {
    constructor() {
      super("PASSWORD");
    }
  },
}));

import { extractPdf, PdfProcessingError } from "@/features/imports/adapters/pdf-adapter";

afterEach(() => {
  vi.clearAllMocks();
});

function createMockInstance(pages: Array<{ num: number; text: string }>, infoTitle?: string) {
  const instance = {
    getInfo: vi.fn().mockResolvedValue({
      info: { Title: infoTitle ?? "PDF Doc" },
      total: pages.length,
    }),
    getText: vi.fn().mockResolvedValue({
      pages,
      text: pages.map((p) => p.text).join("\n"),
      total: pages.length,
    }),
    destroy: vi.fn().mockResolvedValue(undefined),
  };
  mockPDFParseClass.mockImplementation(function (this: typeof instance) {
    Object.assign(this, instance);
  });
  return instance;
}

describe("extractPdf", () => {
  it("extracts text from a single-page PDF", async () => {
    createMockInstance([{ num: 1, text: "Hệ điều hành là phần mềm cơ bản của máy tính." }]);

    const result = await extractPdf(new ArrayBuffer(100));
    expect(result.sourceType).toBe("pdf");
    expect(result.blocks).toHaveLength(1);
    if (result.blocks[0]?.type === "paragraph") {
      expect(result.blocks[0].text).toContain("Hệ điều hành");
    }
    expect(result.totalCharacters).toBeGreaterThan(0);
  });

  it("extracts text from a multi-page PDF with page numbers", async () => {
    createMockInstance([
      { num: 1, text: "Trang một: Giới thiệu." },
      { num: 2, text: "Trang hai: Nội dung chính." },
    ]);

    const result = await extractPdf(new ArrayBuffer(100));
    expect(result.pageCount).toBe(2);
    const page1Blocks = result.blocks.filter((b) => b.page === 1);
    const page2Blocks = result.blocks.filter((b) => b.page === 2);
    expect(page1Blocks.length).toBeGreaterThan(0);
    expect(page2Blocks.length).toBeGreaterThan(0);
  });

  it("detects scan-only PDF (no meaningful text)", async () => {
    createMockInstance(
      [
        { num: 1, text: " " },
        { num: 2, text: "" },
      ],
      "Scanned Doc",
    );

    const result = await extractPdf(new ArrayBuffer(100));
    expect(result.blocks).toHaveLength(0);
    expect(result.totalCharacters).toBe(0);
    expect(result.extractedPageCount).toBe(0);
    expect(result.pagesWithoutText).toBe(2);
  });

  it("handles partial text pages", async () => {
    createMockInstance([
      { num: 1, text: "This page has text." },
      { num: 2, text: "" },
      { num: 3, text: "Third page has content." },
    ]);

    const result = await extractPdf(new ArrayBuffer(100));
    expect(result.extractedPageCount).toBe(2);
    expect(result.pagesWithoutText).toBe(1);
  });

  it("reports correct page metadata", async () => {
    createMockInstance([{ num: 1, text: "Content here. With words." }], "Document Title");

    const result = await extractPdf(new ArrayBuffer(100));
    expect(result.title).toBe("Document Title");
    expect(result.pageCount).toBe(1);
  });

  it("labels text extraction failures without exposing a raw runtime error", async () => {
    const instance = createMockInstance([{ num: 1, text: "Content" }]);
    instance.getText.mockRejectedValue(new Error("DOMMatrix is not defined"));

    await expect(extractPdf(new ArrayBuffer(100))).rejects.toMatchObject({
      name: "PdfProcessingError",
      stage: "pdf.text_extract",
    } satisfies Partial<PdfProcessingError>);
    expect(instance.destroy).toHaveBeenCalledTimes(1);
  });
});
