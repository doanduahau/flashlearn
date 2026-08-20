import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ generateContent: vi.fn(), getGeminiApiKey: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent: mocks.generateContent };
  },
  Type: { OBJECT: "object", ARRAY: "array", STRING: "string", BOOLEAN: "boolean" },
}));
vi.mock("@/lib/env", () => ({
  getGeminiApiKey: mocks.getGeminiApiKey,
  isTestRuntime: () => false,
}));
vi.mock("@/lib/resilience", () => ({
  withCircuitBreaker: (_name: string, operation: () => unknown) => operation(),
  withTimeout: (_name: string, promise: unknown) => promise,
}));

import { GeminiTypingBatchReviewer } from "@/features/typing/server/gemini-answer-check";

const ITEMS = [
  { id: "11111111-1111-4111-8111-111111111111", userAnswer: "RAM", correctAnswer: "RAM" },
  { id: "22222222-2222-4222-8222-222222222222", userAnswer: "CPU", correctAnswer: "processor" },
];

describe("Gemini typing batch mapping", () => {
  const budget = { beforeCall: vi.fn(), afterCall: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getGeminiApiKey.mockReturnValue("test-only-key");
  });

  it("maps every stable item ID exactly once and records usage", async () => {
    mocks.generateContent.mockResolvedValue({
      text: JSON.stringify({
        results: ITEMS.map((item, index) => ({ id: item.id, correct: index === 0, reason: "" })),
      }),
      usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 4 },
    });
    const result = await new GeminiTypingBatchReviewer(budget).review(ITEMS);
    expect(result.map((item) => item.id)).toEqual(ITEMS.map((item) => item.id));
    expect(budget.beforeCall).toHaveBeenCalledOnce();
    expect(budget.afterCall).toHaveBeenCalledWith({ inputTokens: 12, outputTokens: 4 });
  });

  it.each([
    { results: [{ id: ITEMS[0]!.id, correct: true, reason: "" }] },
    {
      results: [
        { id: ITEMS[0]!.id, correct: true, reason: "" },
        { id: ITEMS[0]!.id, correct: false, reason: "duplicate" },
      ],
    },
  ])("fails closed for incomplete or duplicate mappings", async (payload) => {
    mocks.generateContent.mockResolvedValue({ text: JSON.stringify(payload) });
    await expect(new GeminiTypingBatchReviewer(budget).review(ITEMS)).rejects.toThrow();
  });

  it("propagates provider failure so the caller can retain local-wrong results", async () => {
    mocks.generateContent.mockRejectedValue(new Error("provider unavailable"));
    await expect(new GeminiTypingBatchReviewer(budget).review(ITEMS)).rejects.toThrow(
      "provider unavailable",
    );
  });
});
