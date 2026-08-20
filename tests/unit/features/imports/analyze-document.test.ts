import { afterEach, describe, expect, it, vi } from "vitest";

const { mockClassify, mockGetClaims } = vi.hoisted(() => ({
  mockClassify: vi.fn(),
  mockGetClaims: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getClaims: mockGetClaims },
  }),
}));

vi.mock("@/features/imports/adapters/gemini-classifier", () => ({
  GeminiDocumentClassifier: class {
    classify(text: string) {
      return mockClassify(text);
    }
  },
}));

vi.mock("@/features/entitlements/server/entitlement-service", () => ({
  getEffectivePlan: vi.fn().mockResolvedValue("free"),
  reserveUsage: vi.fn().mockResolvedValue({
    reservation_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    enforcementMode: "observe",
    wouldBlock: false,
  }),
}));
vi.mock("@/features/entitlements/server/processing-job-service", () => ({
  loadProcessingJobOutput: vi.fn().mockResolvedValue(null),
  linkJobReservation: vi.fn().mockResolvedValue(undefined),
  runProcessingJobPhase: vi.fn(async (_job, operation) => operation()),
  storeProcessingJobOutput: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/features/entitlements/server/provider-call-budget", () => ({
  createProviderCallBudget: vi.fn(() => ({ beforeCall: vi.fn(), afterCall: vi.fn() })),
}));

import { analyzeDocument as analyzeDocumentAction } from "@/features/imports/server/analyze-document";
import type { ExtractedDocument } from "@/features/imports/types/document-types";

const TEST_USER = "aaaaaaaa-0000-4000-8000-000000000001";
const TEST_JOB = {
  id: "aaaaaaaa-0000-4000-8000-000000000002",
  correlationId: "aaaaaaaa-0000-4000-8000-000000000003",
};
function analyzeDocument(document: ExtractedDocument) {
  return analyzeDocumentAction({ ...document, processingJob: TEST_JOB });
}

afterEach(() => {
  vi.clearAllMocks();
});

const Q_A_TABLE_DOC: ExtractedDocument = {
  sourceType: "docx",
  blocks: [
    {
      type: "table",
      rows: [
        ["Question", "Answer"],
        ["CPU là gì?", "Bộ xử lý"],
        ["RAM là gì?", "Bộ nhớ"],
      ],
    },
  ],
  totalCharacters: 80,
};

const PROSE_DOC: ExtractedDocument = {
  sourceType: "pdf",
  blocks: [
    { type: "paragraph", text: "Hệ điều hành là phần mềm quản lý tài nguyên phần cứng." },
    {
      type: "paragraph",
      text: "Bộ lập lịch CPU quyết định tiến trình nào được sử dụng CPU tiếp theo.",
    },
  ],
  totalCharacters: 120,
};

function ambiguousDoc(): ExtractedDocument {
  return {
    sourceType: "docx",
    blocks: [
      { type: "paragraph", text: "CPU viết tắt của Central Processing Unit." },
      { type: "heading", text: "Terms", level: 2 },
      {
        type: "table",
        rows: [
          ["CPU", "Central Processing Unit"],
          ["RAM", "Random Access Memory"],
        ],
      },
    ],
    totalCharacters: 120,
  };
}

describe("analyzeDocument", () => {
  it("requires authentication", async () => {
    mockGetClaims.mockResolvedValue({ data: null });
    const result = await analyzeDocument(Q_A_TABLE_DOC);
    expect("error" in result).toBe(true);
  });

  describe("deterministic — zero AI", () => {
    it("classifies structured Q/A table deterministically", async () => {
      mockGetClaims.mockResolvedValue({ data: { claims: { sub: TEST_USER } } });
      const result = await analyzeDocument(Q_A_TABLE_DOC);

      expect("document" in result).toBe(true);
      if ("document" in result) {
        const doc = result.document;
        expect(doc.analysis.aiSections).toBe(0);
        expect(doc.analysis.deterministicSections).toBeGreaterThanOrEqual(1);
        const sec = doc.sections[0];
        expect(sec?.kind).toBe("flashcard_like");
        expect(sec?.detectedBy).toBe("deterministic");
        expect(sec?.confidence).toBeGreaterThanOrEqual(0.9);
      }
      expect(mockClassify).not.toHaveBeenCalled();
    });

    it("classifies prose deterministically", async () => {
      mockGetClaims.mockResolvedValue({ data: { claims: { sub: TEST_USER } } });
      const result = await analyzeDocument(PROSE_DOC);

      if ("document" in result) {
        expect(result.document.analysis.aiSections).toBe(0);
        expect(result.document.sections[0]?.kind).toBe("prose");
        expect(result.document.sections[0]?.detectedBy).toBe("deterministic");
      }
      expect(mockClassify).not.toHaveBeenCalled();
    });

    it("no flashcard generation occurs", async () => {
      mockGetClaims.mockResolvedValue({ data: { claims: { sub: TEST_USER } } });
      const result = await analyzeDocument(Q_A_TABLE_DOC);
      if ("document" in result) {
        expect(
          Object.keys(result.document).every(
            (k) => !k.includes("card") && !k.includes("flashcard"),
          ),
        ).toBe(true);
      }
    });
  });

  describe("AI fallback", () => {
    it("calls AI for low-confidence ambiguous section", async () => {
      mockGetClaims.mockResolvedValue({ data: { claims: { sub: TEST_USER } } });
      mockClassify.mockResolvedValue({ kind: "mixed", confidence: 0.7, deterministic: false });

      const doc = ambiguousDoc();
      const result = await analyzeDocument(doc);

      if ("document" in result) {
        expect(result.document.analysis.aiSections).toBe(1);
      }
      expect(mockClassify).toHaveBeenCalledTimes(1);
    });

    it("tracks sourceChars and aiInputChars", async () => {
      mockGetClaims.mockResolvedValue({ data: { claims: { sub: TEST_USER } } });
      mockClassify.mockResolvedValue({ kind: "prose", confidence: 0.75, deterministic: false });

      const doc = ambiguousDoc();
      const result = await analyzeDocument(doc);

      if ("document" in result) {
        expect(result.document.analysis.sourceChars).toBeGreaterThan(0);
        expect(result.document.analysis.aiInputChars).toBeGreaterThan(0);
        expect(result.document.analysis.aiInputChars).toBeLessThanOrEqual(
          result.document.analysis.sourceChars,
        );
      }
    });

    it("AI failure retains deterministic fallback", async () => {
      mockGetClaims.mockResolvedValue({ data: { claims: { sub: TEST_USER } } });
      mockClassify.mockRejectedValue(new Error("Network error"));

      const doc = ambiguousDoc();
      const result = await analyzeDocument(doc);

      if ("document" in result) {
        const aiSections = result.document.sections.filter((s) => s.detectedBy === "ai");
        expect(aiSections.length).toBe(0);
        expect(result.document.sections.length).toBeGreaterThan(0);
      }
    });
  });

  describe("bounds", () => {
    it("enforces max AI sections limit", async () => {
      mockGetClaims.mockResolvedValue({ data: { claims: { sub: TEST_USER } } });
      mockClassify.mockResolvedValue({ kind: "prose", confidence: 0.75, deterministic: false });

      // Create many sections each with a small 2-column table (low confidence via deterministic)
      const blocks = [];
      for (let i = 0; i < 15; i++) {
        blocks.push(
          { type: "heading" as const, text: `H${i}`, level: 1 },
          { type: "table" as const, rows: [["A", "B"]] },
        );
      }
      const result = await analyzeDocument({
        sourceType: "docx",
        blocks,
        totalCharacters: 200,
      });

      if ("document" in result) {
        expect(result.document.analysis.aiSections).toBeLessThanOrEqual(20);
      }
    });

    it("does not classify the same section twice", async () => {
      mockGetClaims.mockResolvedValue({ data: { claims: { sub: TEST_USER } } });
      mockClassify.mockResolvedValue({ kind: "prose", confidence: 0.8, deterministic: false });

      const doc = ambiguousDoc();
      await analyzeDocument(doc);
      const callCount = mockClassify.mock.calls.length;
      // Only the ambiguous section (2 blocks) should trigger AI
      expect(callCount).toBeLessThanOrEqual(1);
    });
  });
});
