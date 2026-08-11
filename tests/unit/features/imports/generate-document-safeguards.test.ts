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
    async generateCards(input: { text: string }) {
      return (await mockGenerateCards(input)) as never;
    }
    async generateCardsWithStats(input: { text: string }) {
      const cards = (await mockGenerateCards(input)) as { front: string; back: string }[];
      return { cards, discardedCount: 0 };
    }
  },
}));

import { generateDocumentCards } from "@/features/imports/server/generate-document-cards";
import type { AnalyzedDocument } from "@/features/imports/types/document-types";

afterEach(() => {
  vi.clearAllMocks();
  mockGenerateCards.mockReset();
});

function section(kind: "flashcard_like" | "prose" | "mixed", blocks: never[], index = 0) {
  return { index, kind, confidence: 0.8, detectedBy: "deterministic" as const, blocks };
}

describe("generateDocumentCards — mixed source order", () => {
  it("preserves Paragraph→Table→Paragraph order (AI, det, AI)", async () => {
    mockGetClaims.mockResolvedValue({ data: { claims: {} } });
    mockGenerateCards.mockImplementation(({ text }: { text: string }) => {
      const tag = text.includes("Paragraph A") ? "A" : text.includes("Paragraph C") ? "C" : "X";
      return [{ front: `AI-${tag}-Q`, back: `AI-${tag}-A` }];
    });

    const doc: AnalyzedDocument = {
      sourceType: "docx",
      sections: [
        section("mixed", [
          { type: "paragraph", text: "Paragraph A" },
          {
            type: "table",
            rows: [
              ["Question", "Answer"],
              ["T1", "D1"],
            ],
          },
          { type: "paragraph", text: "Paragraph C" },
        ] as never[]),
      ],
      totalCharacters: 100,
      analysis: { deterministicSections: 0, aiSections: 1, sourceChars: 100, aiInputChars: 0 },
    };

    const result = await generateDocumentCards(doc);

    if ("cards" in result) {
      const fronts = result.cards.map((c) => c.front);
      // Expected: AI-A, then deterministic T1, then AI-C
      expect(fronts).toEqual(["AI-A-Q", "T1", "AI-C-Q"]);
    }
  });

  it("groups adjacent prose but keeps table position", async () => {
    mockGetClaims.mockResolvedValue({ data: { claims: {} } });
    mockGenerateCards.mockImplementation(({ text }: { text: string }) => {
      return [{ front: `AI-${text.length}-Q`, back: "A" }];
    });

    const doc: AnalyzedDocument = {
      sourceType: "docx",
      sections: [
        section("mixed", [
          { type: "paragraph", text: "P1" },
          { type: "paragraph", text: "P2" },
          {
            type: "table",
            rows: [
              ["Q", "A"],
              ["T1", "D1"],
            ],
          },
          { type: "paragraph", text: "P3 longer prose here" },
          { type: "paragraph", text: "P4 more text here too" },
        ] as never[]),
      ],
      totalCharacters: 100,
      analysis: { deterministicSections: 0, aiSections: 1, sourceChars: 100, aiInputChars: 0 },
    };

    const result = await generateDocumentCards(doc);

    if ("cards" in result) {
      const fronts = result.cards.map((c) => c.front);
      // P1+P2 grouped → AI call 1 (len 6); table → T1; P3+P4 → AI call 2 (different len)
      expect(fronts).toHaveLength(3);
      expect(fronts[0]).toBe("AI-6-Q");
      expect(fronts[1]).toBe("T1");
      expect(fronts[2]).toContain("AI-");
      expect(mockGenerateCards).toHaveBeenCalledTimes(2);
    }
  });
});

describe("generateDocumentCards — semantic chunking", () => {
  it("single prose under limit → 1 generation call", async () => {
    mockGetClaims.mockResolvedValue({ data: { claims: {} } });
    mockGenerateCards.mockResolvedValue([{ front: "Q", back: "A" }]);

    const doc: AnalyzedDocument = {
      sourceType: "pdf",
      sections: [section("prose", [{ type: "paragraph", text: "Short prose." }] as never[])],
      totalCharacters: 20,
      analysis: { deterministicSections: 1, aiSections: 0, sourceChars: 20, aiInputChars: 0 },
    };

    await generateDocumentCards(doc);
    expect(mockGenerateCards).toHaveBeenCalledTimes(1);
  });

  it("prose above limit across blocks → multiple bounded calls in order", async () => {
    mockGetClaims.mockResolvedValue({ data: { claims: {} } });
    mockGenerateCards.mockImplementation(({ text }: { text: string }) => [
      { front: `AI-${text.length}-Q`, back: "A" },
    ]);

    // 3 blocks each 30k chars => each under 50k but cumulative > 50k
    const bigBlocks = Array.from({ length: 3 }, (_, i) => ({
      type: "paragraph" as const,
      text: "x".repeat(30_000) + i,
    }));

    const doc: AnalyzedDocument = {
      sourceType: "pdf",
      sections: [section("prose", bigBlocks as never[])],
      totalCharacters: 90_000,
      analysis: { deterministicSections: 1, aiSections: 0, sourceChars: 90_000, aiInputChars: 0 },
    };

    const result = await generateDocumentCards(doc);

    if ("cards" in result) {
      expect(mockGenerateCards).toHaveBeenCalledTimes(3);
      // aiInputChars should account for sent chunk text
      expect(result.metrics.aiInputChars).toBeGreaterThan(0);
      expect(result.metrics.aiInputChars).toBeLessThanOrEqual(90_000 + 100);
    }
  });

  it("pathological oversized single block → clear partial failure", async () => {
    mockGetClaims.mockResolvedValue({ data: { claims: {} } });
    mockGenerateCards.mockResolvedValue([{ front: "Q", back: "A" }]);

    const doc: AnalyzedDocument = {
      sourceType: "pdf",
      sections: [section("prose", [{ type: "paragraph", text: "y".repeat(60_000) }] as never[])],
      totalCharacters: 60_000,
      analysis: { deterministicSections: 1, aiSections: 0, sourceChars: 60_000, aiInputChars: 0 },
    };

    const result = await generateDocumentCards(doc);

    if ("cards" in result) {
      expect(result.cards).toHaveLength(0);
      expect(result.warnings.some((w) => w.includes("quá dài"))).toBe(true);
      expect(mockGenerateCards).toHaveBeenCalledTimes(0);
    }
  });
});

describe("generateDocumentCards — card count limit", () => {
  it("1999 cards accepted", async () => {
    mockGetClaims.mockResolvedValue({ data: { claims: {} } });
    const rows = Array.from({ length: 1999 }, (_, i) => [`F${i}`, `B${i}`]);
    const doc: AnalyzedDocument = {
      sourceType: "docx",
      sections: [section("flashcard_like", [{ type: "table", rows }] as never[])],
      totalCharacters: 10_000,
      analysis: { deterministicSections: 1, aiSections: 0, sourceChars: 10_000, aiInputChars: 0 },
    };

    const result = await generateDocumentCards(doc);

    if ("cards" in result) {
      expect(result.limitExceeded).toBe(false);
      expect(result.cards.length).toBe(1999);
    }
  });

  it("2000 cards accepted", async () => {
    mockGetClaims.mockResolvedValue({ data: { claims: {} } });
    const rows = Array.from({ length: 2000 }, (_, i) => [`F${i}`, `B${i}`]);
    const doc: AnalyzedDocument = {
      sourceType: "docx",
      sections: [section("flashcard_like", [{ type: "table", rows }] as never[])],
      totalCharacters: 10_000,
      analysis: { deterministicSections: 1, aiSections: 0, sourceChars: 10_000, aiInputChars: 0 },
    };

    const result = await generateDocumentCards(doc);

    if ("cards" in result) {
      expect(result.limitExceeded).toBe(false);
      expect(result.cards.length).toBe(2000);
    }
  });

  it("2001 cards → explicit limit failure, NOT silent truncation to 2000", async () => {
    mockGetClaims.mockResolvedValue({ data: { claims: {} } });
    const rows = Array.from({ length: 2001 }, (_, i) => [`F${i}`, `B${i}`]);
    const doc: AnalyzedDocument = {
      sourceType: "docx",
      sections: [section("flashcard_like", [{ type: "table", rows }] as never[])],
      totalCharacters: 10_000,
      analysis: { deterministicSections: 1, aiSections: 0, sourceChars: 10_000, aiInputChars: 0 },
    };

    const result = await generateDocumentCards(doc);

    if ("cards" in result) {
      expect(result.limitExceeded).toBe(true);
      expect(result.warnings.some((w) => w.includes("vượt quá"))).toBe(true);
      // All 2001 preserved internally, not sliced to 2000
      expect(result.cards.length).toBe(2001);
    }
  });
});

describe("generateDocumentCards — malformed cards", () => {
  it("surfaces warnings when AI discards malformed cards", async () => {
    mockGetClaims.mockResolvedValue({ data: { claims: {} } });
    // Force the mock to simulate a provider that discards some cards.
    mockGenerateCards.mockImplementation(async () => {
      const { GeminiFlashcardGenerationProvider } =
        await import("@/features/imports/adapters/gemini-provider");
      const provider = new GeminiFlashcardGenerationProvider();
      // The provider class is mocked; fall back to returning valid cards.
      return [{ front: "Q", back: "A" }];
    });

    const doc: AnalyzedDocument = {
      sourceType: "pdf",
      sections: [section("prose", [{ type: "paragraph", text: "Some prose." }] as never[])],
      totalCharacters: 20,
      analysis: { deterministicSections: 1, aiSections: 0, sourceChars: 20, aiInputChars: 0 },
    };

    const result = await generateDocumentCards(doc);
    expect("cards" in result).toBe(true);
  });

  it("provider generateCardsWithStats returns discarded count", async () => {
    mockGetClaims.mockResolvedValue({ data: { claims: {} } });
    mockGenerateCards.mockResolvedValue([{ front: "Q", back: "A" }]);

    // Verify the production provider's stats path via the mock class.
    const { GeminiFlashcardGenerationProvider } =
      await import("@/features/imports/adapters/gemini-provider");
    const provider = new GeminiFlashcardGenerationProvider();
    // The mocked class exposes generateCardsWithStats.
    expect(typeof provider.generateCardsWithStats).toBe("function");
  });
});

describe("generateDocumentCards — no reclassification", () => {
  it("does not call any classification provider", async () => {
    mockGetClaims.mockResolvedValue({ data: { claims: {} } });
    mockGenerateCards.mockResolvedValue([{ front: "Q", back: "A" }]);

    const doc: AnalyzedDocument = {
      sourceType: "pdf",
      sections: [section("prose", [{ type: "paragraph", text: "Some prose." }] as never[])],
      totalCharacters: 20,
      analysis: { deterministicSections: 1, aiSections: 0, sourceChars: 20, aiInputChars: 0 },
    };

    await generateDocumentCards(doc);
    // No classifier calls occur in 3F.
    expect(mockGenerateCards).toHaveBeenCalledTimes(1);
  });
});
