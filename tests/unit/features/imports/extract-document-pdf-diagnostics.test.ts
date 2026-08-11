import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  extractPdf: vi.fn(),
  loggerError: vi.fn(),
  PdfProcessingError: class PdfProcessingError extends Error {
    readonly originalError: unknown;
    readonly workerConfigured: boolean | undefined;

    constructor(
      readonly stage: string,
      originalError: unknown,
      options?: { workerConfigured?: boolean },
    ) {
      super("PDF_PROCESSING_FAILED");
      this.name = "PdfProcessingError";
      this.originalError = originalError;
      this.workerConfigured = options?.workerConfigured;
    }
  },
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/logger", () => ({
  logger: { error: mocks.loggerError },
}));
vi.mock("@/features/imports/adapters/pdf-adapter", () => ({
  extractPdf: mocks.extractPdf,
  PDFEncryptedError: class PDFEncryptedError extends Error {},
  PdfProcessingError: mocks.PdfProcessingError,
}));

import { extractDocument } from "@/features/imports/server/extract-document";

afterEach(() => {
  vi.clearAllMocks();
});

describe("extractDocument PDF diagnostics", () => {
  it("logs safe PDF runtime metadata while returning only the generic client error", async () => {
    const privateDocumentContent = "private PDF text must never be logged";
    mocks.createClient.mockResolvedValue({
      auth: { getClaims: vi.fn().mockResolvedValue({ data: { claims: { sub: "user" } } }) },
    });
    mocks.extractPdf.mockRejectedValue(
      new mocks.PdfProcessingError("pdf.text_extract", new Error(privateDocumentContent), {
        workerConfigured: false,
      }),
    );

    const formData = new FormData();
    formData.append(
      "file",
      new File([privateDocumentContent], "document.pdf", { type: "application/pdf" }),
    );

    const result = await extractDocument(formData);

    expect(result).toEqual({
      error: "Không thể đọc tệp này. Hãy kiểm tra tệp chưa bị hỏng.",
    });
    expect(mocks.loggerError).toHaveBeenCalledWith(
      "pdf extraction failed",
      expect.objectContaining({
        stage: "pdf.text_extract",
        errorName: "Error",
        errorMessage: "Unclassified PDF runtime error",
        workerConfigured: false,
        fileSizeBytes: privateDocumentContent.length,
      }),
    );
    expect(JSON.stringify(mocks.loggerError.mock.calls)).not.toContain(privateDocumentContent);
    expect(JSON.stringify(result)).not.toContain(privateDocumentContent);
  });
});
