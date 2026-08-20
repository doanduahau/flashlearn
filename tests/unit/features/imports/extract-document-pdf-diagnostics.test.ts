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
  PDFPageLimitError: class PDFPageLimitError extends Error {},
  PdfProcessingError: mocks.PdfProcessingError,
}));
vi.mock("@/features/entitlements/server/entitlement-service", () => ({
  getEffectivePlan: vi.fn().mockResolvedValue("free"),
  reserveUsage: vi.fn().mockResolvedValue({
    reservation_id: null,
    reservation_status: "reserved",
    enforcementMode: "observe",
    wouldBlock: false,
  }),
  finalizeUsage: vi.fn(),
  refundUsage: vi.fn(),
}));
vi.mock("@/features/entitlements/server/processing-job-service", () => ({
  startProcessingJob: vi.fn().mockResolvedValue({
    id: "11111111-1111-4111-8111-111111111111",
    status: "queued",
    replayed: false,
    physicalCallLimit: 5,
  }),
  runProcessingJobPhase: vi.fn(async (_job, operation) => operation()),
  linkJobReservation: vi.fn(),
  finishProcessingJob: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/security/rate-limit", () => ({
  consumeRateLimit: vi.fn().mockResolvedValue({ ok: true }),
  rateLimitMessage: vi.fn(),
  subjectRateLimitKey: vi.fn().mockReturnValue("test-subject"),
}));

import { extractDocument } from "@/features/imports/server/extract-document";

afterEach(() => {
  vi.clearAllMocks();
});

describe("extractDocument PDF diagnostics", () => {
  it("logs safe PDF runtime metadata while returning only the generic client error", async () => {
    const privateDocumentContent = "%PDF-1.7\nprivate PDF text must never be logged";
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
    formData.append("idempotencyKey", "22222222-2222-4222-8222-222222222222");

    const result = await extractDocument(formData);

    expect(result).toEqual({
      error: "Không thể đọc tệp này. Hãy kiểm tra tệp chưa bị hỏng.",
    });
    expect(mocks.loggerError).toHaveBeenCalledWith(
      "pdf extraction failed",
      expect.objectContaining({
        stage: "pdf.text_extract",
        errorName: "Error",
        category: "unclassified",
        workerConfigured: false,
        fileSizeBytes: privateDocumentContent.length,
      }),
    );
    expect(JSON.stringify(mocks.loggerError.mock.calls)).not.toContain(privateDocumentContent);
    expect(JSON.stringify(result)).not.toContain(privateDocumentContent);
  });
});
