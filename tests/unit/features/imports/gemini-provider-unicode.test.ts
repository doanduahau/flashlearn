import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockGenerateContent, mockGetGeminiApiKey } = vi.hoisted(() => ({
  mockGenerateContent: vi.fn(),
  mockGetGeminiApiKey: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent: mockGenerateContent };
  },
  Type: {
    OBJECT: "object",
    ARRAY: "array",
    STRING: "string",
  },
}));

vi.mock("@/lib/env", () => ({
  getGeminiApiKey: mockGetGeminiApiKey,
}));

import { GeminiFlashcardGenerationProvider } from "@/features/imports/adapters/gemini-provider";

const SOURCE_TEXT = [
  "RAM là gì?",
  "Tiến trình là gì?",
  "Người sử dụng dữ liệu trong hệ thống.",
].join("\n");

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

beforeEach(() => {
  mockGetGeminiApiKey.mockReturnValue("test-key");
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("GeminiFlashcardGenerationProvider Unicode fidelity", () => {
  it("preserves exact Vietnamese provider output and sends an explicit Unicode-fidelity prompt", async () => {
    const rawResponse = JSON.stringify({
      cards: [
        {
          front: "RAM là gì?",
          back: "Tiến trình là gì? Người sử dụng dữ liệu trong hệ thống.",
        },
      ],
    });
    mockGenerateContent.mockResolvedValue({ text: rawResponse });

    const provider = new GeminiFlashcardGenerationProvider();
    const result = await provider.generateCardsWithStats({ text: SOURCE_TEXT });

    expect(result.cards).toEqual([
      {
        front: "RAM là gì?",
        back: "Tiến trình là gì? Người sử dụng dữ liệu trong hệ thống.",
      },
    ]);

    const request = mockGenerateContent.mock.calls[0]?.[0] as {
      contents: Array<{ parts: Array<{ text: string }> }>;
    };
    const prompt = request.contents[0]?.parts[0]?.text;
    expect(prompt).toContain(SOURCE_TEXT);
    expect(prompt).toContain("retain Vietnamese diacritics (including đ/Đ)");
    expect(prompt).toContain("never strip accents, transliterate text, or convert it to ASCII");
  });

  it("preserves the full Vietnamese diacritic matrix exactly through provider JSON parsing", async () => {
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({
        cards: [{ front: "Unicode matrix", back: VIETNAMESE_DIACRITIC_MATRIX }],
      }),
    });

    const provider = new GeminiFlashcardGenerationProvider();
    const result = await provider.generateCardsWithStats({ text: "Unicode preservation fixture" });

    expect(result.cards).toEqual([{ front: "Unicode matrix", back: VIETNAMESE_DIACRITIC_MATRIX }]);
  });
});
