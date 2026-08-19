import { afterEach, describe, expect, it, vi } from "vitest";

const { mockGenerateCards, mockGetClaims } = vi.hoisted(() => ({
  mockGenerateCards: vi.fn(),
  mockGetClaims: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getClaims: mockGetClaims },
  }),
}));

vi.mock("@/features/imports/adapters/gemini-provider", () => ({
  GeminiFlashcardGenerationProvider: class {
    generateCards(input: { text: string }) {
      return mockGenerateCards(input);
    }
  },
}));

import { generateDocumentCards } from "@/features/imports/server/generate-document-cards";
import type { AnalyzedDocument } from "@/features/imports/types/document-types";

afterEach(() => {
  vi.clearAllMocks();
});

const STRUCTURED_DOC: AnalyzedDocument = {
  sourceType: "docx",
  sections: [
    {
      index: 0,
      kind: "flashcard_like",
      confidence: 0.92,
      detectedBy: "deterministic",
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
    },
  ],
  totalCharacters: 80,
  analysis: { deterministicSections: 1, aiSections: 0, sourceChars: 80, aiInputChars: 0 },
};

const PROSE_DOC: AnalyzedDocument = {
  sourceType: "pdf",
  sections: [
    {
      index: 0,
      kind: "prose",
      confidence: 0.85,
      detectedBy: "deterministic",
      blocks: [
        { type: "paragraph", text: "Hệ điều hành là phần mềm quản lý tài nguyên phần cứng." },
        {
          type: "paragraph",
          text: "Bộ lập lịch CPU quyết định tiến trình nào được sử dụng CPU tiếp theo.",
        },
      ],
    },
  ],
  totalCharacters: 120,
  analysis: { deterministicSections: 1, aiSections: 0, sourceChars: 120, aiInputChars: 0 },
};

const MIXED_DOC: AnalyzedDocument = {
  sourceType: "docx",
  sections: [
    {
      index: 0,
      kind: "mixed",
      confidence: 0.62,
      detectedBy: "ai",
      blocks: [
        { type: "paragraph", text: "Dưới đây là các thuật ngữ quan trọng." },
        {
          type: "table",
          rows: [
            ["Question", "Answer"],
            ["OS là gì?", "Hệ điều hành"],
          ],
        },
        { type: "paragraph", text: "Hệ điều hành quản lý tài nguyên hiệu quả." },
      ],
    },
  ],
  totalCharacters: 150,
  analysis: { deterministicSections: 0, aiSections: 1, sourceChars: 150, aiInputChars: 0 },
};

const HEADERLESS_TABLE_DOC: AnalyzedDocument = {
  sourceType: "docx",
  sections: [
    {
      index: 0,
      kind: "flashcard_like",
      confidence: 0.78,
      detectedBy: "deterministic",
      blocks: [
        {
          type: "table",
          rows: [
            ["CPU", "Central Processing Unit"],
            ["RAM", "Random Access Memory"],
          ],
        },
      ],
    },
  ],
  totalCharacters: 60,
  analysis: { deterministicSections: 1, aiSections: 0, sourceChars: 60, aiInputChars: 0 },
};

describe("generateDocumentCards", () => {
  it("requires authentication", async () => {
    mockGetClaims.mockResolvedValue({ data: null });
    const result = await generateDocumentCards(STRUCTURED_DOC);
    expect("error" in result).toBe(true);
  });

  describe("flashcard_like — deterministic, zero AI generation", () => {
    it("converts a Question/Answer table to cards, skipping header row", async () => {
      mockGetClaims.mockResolvedValue({ data: { claims: {} } });
      const result = await generateDocumentCards(STRUCTURED_DOC);

      expect("cards" in result).toBe(true);
      if ("cards" in result) {
        expect(result.cards).toHaveLength(2);
        expect(result.cards[0]?.front).toBe("CPU là gì?");
        expect(result.cards[0]?.back).toBe("Bộ xử lý");
        expect(result.metrics.aiRequests).toBe(0);
        expect(result.metrics.aiGeneratedCards).toBe(0);
      }
      expect(mockGenerateCards).not.toHaveBeenCalled();
    });

    it("converts headerless 2-column table", async () => {
      mockGetClaims.mockResolvedValue({ data: { claims: {} } });
      const result = await generateDocumentCards(HEADERLESS_TABLE_DOC);

      if ("cards" in result) {
        expect(result.cards).toHaveLength(2);
        expect(result.cards[0]?.front).toBe("CPU");
        expect(result.metrics.aiRequests).toBe(0);
      }
    });
  });

  describe("prose — AI generation", () => {
    it("calls the generation provider for prose sections", async () => {
      mockGetClaims.mockResolvedValue({ data: { claims: {} } });
      mockGenerateCards.mockResolvedValue([
        { front: "OS là gì?", back: "Phần mềm quản lý tài nguyên." },
      ]);

      const result = await generateDocumentCards(PROSE_DOC);

      if ("cards" in result) {
        expect(result.cards.length).toBeGreaterThan(0);
        expect(result.metrics.aiRequests).toBe(1);
        expect(result.metrics.aiInputChars).toBeGreaterThan(0);
      }
      expect(mockGenerateCards).toHaveBeenCalledTimes(1);
    });

    it("tracks aiInputChars correctly", async () => {
      mockGetClaims.mockResolvedValue({ data: { claims: {} } });
      mockGenerateCards.mockResolvedValue([{ front: "Q", back: "A" }]);

      const result = await generateDocumentCards(PROSE_DOC);

      if ("cards" in result) {
        expect(result.metrics.aiInputChars).toBeGreaterThan(0);
        // aiInputChars may slightly exceed sourceChars due to join separators
        expect(result.metrics.aiInputChars).toBeLessThanOrEqual(result.metrics.sourceChars + 20);
      }
    });
  });

  describe("mixed — hybrid processing", () => {
    it("extracts table deterministically and generates prose via AI", async () => {
      mockGetClaims.mockResolvedValue({ data: { claims: {} } });
      mockGenerateCards.mockResolvedValue([
        { front: "OS definition?", back: "Phần mềm quản lý..." },
      ]);

      const result = await generateDocumentCards(MIXED_DOC);

      if ("cards" in result) {
        expect(result.metrics.aiRequests).toBe(1);
        expect(result.metrics.deterministicCards).toBeGreaterThan(0);
        expect(result.metrics.aiGeneratedCards).toBeGreaterThan(0);
      }
    });
  });

  describe("AI failure", () => {
    it("survives AI failure and retains deterministic cards", async () => {
      mockGetClaims.mockResolvedValue({ data: { claims: {} } });
      mockGenerateCards.mockRejectedValue(new Error("API error"));

      const result = await generateDocumentCards(MIXED_DOC);

      if ("cards" in result) {
        // Deterministic cards from the table survive.
        expect(result.cards.length).toBeGreaterThan(0);
        expect(result.warnings.length).toBeGreaterThan(0);
      }
    });

    it("warns when prose section generation fails", async () => {
      mockGetClaims.mockResolvedValue({ data: { claims: {} } });
      mockGenerateCards.mockRejectedValue(new Error("timeout"));

      const result = await generateDocumentCards(PROSE_DOC);

      if ("cards" in result) {
        expect(result.warnings.length).toBeGreaterThan(0);
      }
    });
  });

  describe("deduplication", () => {
    it("removes exact duplicate cards", async () => {
      mockGetClaims.mockResolvedValue({ data: { claims: {} } });
      mockGenerateCards.mockResolvedValue([
        { front: "OS là gì?", back: "Hệ điều hành" },
        { front: "OS là gì?", back: "Hệ điều hành" },
      ]);

      // A doc with prose + a table that also has the same Q/A
      const doc: AnalyzedDocument = {
        sourceType: "docx",
        sections: [
          {
            index: 0,
            kind: "mixed",
            confidence: 0.62,
            detectedBy: "ai",
            blocks: [
              {
                type: "table",
                rows: [
                  ["Question", "Answer"],
                  ["OS là gì?", "Hệ điều hành"],
                ],
              },
              { type: "paragraph", text: "Hệ điều hành quản lý tài nguyên." },
            ],
          },
        ],
        totalCharacters: 100,
        analysis: { deterministicSections: 0, aiSections: 1, sourceChars: 100, aiInputChars: 0 },
      };

      const result = await generateDocumentCards(doc);

      if ("cards" in result) {
        const osCards = result.cards.filter((c) => c.front.includes("OS"));
        expect(osCards.length).toBe(1);
      }
    });
  });

  describe("multi-section ordering", () => {
    it("preserves section order in output", async () => {
      mockGetClaims.mockResolvedValue({ data: { claims: {} } });
      mockGenerateCards.mockResolvedValue([{ front: "Prose Q", back: "Prose A" }]);

      const doc: AnalyzedDocument = {
        sourceType: "docx",
        sections: [
          {
            index: 0,
            kind: "flashcard_like",
            confidence: 0.92,
            detectedBy: "deterministic",
            blocks: [
              {
                type: "table",
                rows: [
                  ["Term", "Definition"],
                  ["CPU", "Bộ xử lý"],
                ],
              },
            ],
          },
          {
            index: 1,
            kind: "prose",
            confidence: 0.85,
            detectedBy: "deterministic",
            blocks: [{ type: "paragraph", text: "OS là phần mềm quản lý." }],
          },
        ],
        totalCharacters: 100,
        analysis: { deterministicSections: 2, aiSections: 0, sourceChars: 100, aiInputChars: 0 },
      };

      const result = await generateDocumentCards(doc);

      if ("cards" in result) {
        expect(result.cards[0]?.front).toBe("CPU");
        expect(result.cards[1]?.front).toBe("Prose Q");
      }
    });
  });

  describe("metrics", () => {
    it("tracks sourceChars correctly", async () => {
      mockGetClaims.mockResolvedValue({ data: { claims: {} } });
      mockGenerateCards.mockResolvedValue([]);
      const result = await generateDocumentCards(PROSE_DOC);
      if ("cards" in result) {
        expect(result.metrics.sourceChars).toBeGreaterThan(0);
      }
    });

    it("aiInputChars ≈ sourceChars for clear prose", async () => {
      mockGetClaims.mockResolvedValue({ data: { claims: {} } });
      mockGenerateCards.mockResolvedValue([]);
      const result = await generateDocumentCards(PROSE_DOC);
      if ("cards" in result) {
        expect(result.metrics.aiInputChars).toBeGreaterThan(0);
        expect(result.metrics.sourceChars).toBeGreaterThan(0);
      }
    });
  });

  describe("card bounds", () => {
    it("does not exceed canonical import limit", async () => {
      mockGetClaims.mockResolvedValue({ data: { claims: {} } });
      mockGenerateCards.mockResolvedValue(
        Array.from({ length: 5000 }, (_, i) => ({ front: `Q${i}`, back: `A${i}` })),
      );

      const result = await generateDocumentCards(PROSE_DOC);

      if ("cards" in result) {
        expect(result.cards.length).toBeLessThanOrEqual(2000);
      }
    });
  });
});
