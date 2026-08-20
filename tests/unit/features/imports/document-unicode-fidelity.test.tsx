import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockClassify, mockGenerateCards, mockGetClaims } = vi.hoisted(() => ({
  mockClassify: vi.fn(),
  mockGenerateCards: vi.fn(),
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

vi.mock("@/features/imports/adapters/gemini-provider", () => ({
  GeminiFlashcardGenerationProvider: class {
    constructor(private readonly budget: { beforeCall(chars: number): Promise<void> }) {}
    async generateCards(input: { text: string }) {
      await this.budget.beforeCall(input.text.length);
      return mockGenerateCards(input);
    }
    async generateCardsWithStats(input: { text: string }) {
      await this.budget.beforeCall(input.text.length);
      return { cards: await mockGenerateCards(input), discardedCount: 0 };
    }
  },
}));

vi.mock("@/features/entitlements/server/entitlement-service", () => ({
  getEffectivePlan: vi.fn().mockResolvedValue("free"),
  reserveUsage: vi.fn().mockResolvedValue({
    reservation_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    reservation_status: "reserved",
    enforcementMode: "observe",
    wouldBlock: false,
  }),
  finalizeUsage: vi.fn().mockResolvedValue(undefined),
  refundUsage: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/features/entitlements/server/processing-job-service", () => ({
  loadProcessingJobOutput: vi.fn().mockResolvedValue(null),
  linkJobReservation: vi.fn().mockResolvedValue(undefined),
  runProcessingJobPhase: vi.fn(async (_job, operation) => operation()),
  storeProcessingJobOutput: vi.fn().mockResolvedValue(undefined),
  finishProcessingJob: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/features/entitlements/server/provider-call-budget", () => ({
  createProviderCallBudget: vi.fn(() => ({ beforeCall: vi.fn(), afterCall: vi.fn() })),
}));

import { analyzeDocument as analyzeDocumentAction } from "@/features/imports/server/analyze-document";
import { generateDocumentCards as generateDocumentCardsAction } from "@/features/imports/server/generate-document-cards";
import type { ExtractedDocument } from "@/features/imports/types/document-types";

const TEST_USER = "dddddddd-0000-4000-8000-000000000001";
const TEST_JOB = {
  id: "dddddddd-0000-4000-8000-000000000002",
  correlationId: "dddddddd-0000-4000-8000-000000000003",
};
function analyzeDocument(document: ExtractedDocument) {
  return analyzeDocumentAction({ ...document, processingJob: TEST_JOB });
}
function generateDocumentCards(document: Parameters<typeof generateDocumentCardsAction>[0]) {
  return generateDocumentCardsAction({ ...document, processingJob: TEST_JOB });
}

const EXTRACTED_PARAGRAPHS = [
  "RAM là gì?",
  "Tiến trình là gì?",
  "Người sử dụng dữ liệu trong hệ thống.",
];

const PROVIDER_CARD = {
  front: "RAM là gì?",
  back: "Tiến trình là gì? Người sử dụng dữ liệu trong hệ thống.",
};

const VIETNAMESE_DIACRITIC_MATRIX = [
  "à á ả ã ạ",
  "ă ằ ắ ẳ ẵ ặ",
  "â ầ ấ ẩ ẫ ậ",
  "è é ẻ ẽ ẹ",
  "ê ề ế ể ễ ệ",
  "ì í ỉ ĩ ị",
  "ò ó ỏ õ ọ",
  "ô ồ ố ổ ỗ ộ",
  "ơ ờ ớ ở ỡ ợ",
  "ù ú ủ ũ ụ",
  "ư ừ ứ ử ữ ự",
  "ỳ ý ỷ ỹ ỵ",
  "đ Đ",
].join("\n");

const EXTRACTED_DOCUMENT: ExtractedDocument = {
  sourceType: "pdf",
  blocks: EXTRACTED_PARAGRAPHS.map((text) => ({ type: "paragraph", text, page: 1 })),
  totalCharacters: EXTRACTED_PARAGRAPHS.reduce((total, text) => total + text.length, 0),
  pageCount: 1,
  extractedPageCount: 1,
  pagesWithoutText: 0,
};

beforeEach(() => {
  mockGetClaims.mockResolvedValue({ data: { claims: { sub: TEST_USER } } });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("document card Unicode fidelity", () => {
  it("preserves exact PDF extraction text through analysis and generation", async () => {
    mockGenerateCards.mockResolvedValue([PROVIDER_CARD]);

    // A: extracted PDF text is the exact production regression fixture.
    expect(
      EXTRACTED_DOCUMENT.blocks.map((block) => (block.type === "paragraph" ? block.text : "")),
    ).toEqual(EXTRACTED_PARAGRAPHS);

    const analyzed = await analyzeDocument(EXTRACTED_DOCUMENT);
    expect("document" in analyzed).toBe(true);
    if (!("document" in analyzed)) throw new Error("Expected analyzed document");

    const section = analyzed.document.sections[0];
    // B: section construction preserves every extracted character.
    expect(section?.blocks.map((block) => (block.type === "paragraph" ? block.text : ""))).toEqual(
      EXTRACTED_PARAGRAPHS,
    );
    expect(section).toMatchObject({ kind: "prose", confidence: 0.68, detectedBy: "deterministic" });
    expect(analyzed.document.analysis.aiSections).toBe(0);
    expect(mockClassify).not.toHaveBeenCalled();

    const generated = await generateDocumentCards(analyzed.document);
    expect("cards" in generated).toBe(true);
    if (!("cards" in generated)) throw new Error("Expected generated cards");

    // C: prose is sent to the generation provider unchanged apart from intentional block separators.
    expect(mockGenerateCards).toHaveBeenCalledWith({ text: EXTRACTED_PARAGRAPHS.join("\n\n") });
    expect(generated.metrics.aiRequests).toBe(1);
    // D/E: parsed provider result and DraftFlashcard values are exact.
    expect(generated.cards).toEqual([PROVIDER_CARD]);
  });

  it("does not strip Vietnamese combining characters in deterministic document cards", async () => {
    const analyzed = {
      sourceType: "pdf" as const,
      sections: [
        {
          index: 0,
          kind: "flashcard_like" as const,
          confidence: 0.92,
          detectedBy: "deterministic" as const,
          blocks: [
            {
              type: "table" as const,
              rows: [
                ["Mặt trước", "Mặt sau"],
                ["RAM là gì?", VIETNAMESE_DIACRITIC_MATRIX],
              ],
            },
          ],
        },
      ],
      totalCharacters: VIETNAMESE_DIACRITIC_MATRIX.length,
      analysis: { deterministicSections: 1, aiSections: 0, sourceChars: 0, aiInputChars: 0 },
    };

    const generated = await generateDocumentCards(analyzed);

    expect("cards" in generated).toBe(true);
    if (!("cards" in generated)) throw new Error("Expected generated cards");
    expect(generated.cards).toEqual([{ front: "RAM là gì?", back: VIETNAMESE_DIACRITIC_MATRIX }]);
    expect(generated.metrics.aiRequests).toBe(0);
    expect(mockGenerateCards).not.toHaveBeenCalled();
  });
});
