import "server-only";

import { appendFileSync, existsSync, readFileSync } from "node:fs";

import { GoogleGenAI, Type } from "@google/genai";

import type { ProviderCallBudget } from "@/features/entitlements/server/provider-call-budget";
import { GEMINI_RETRY_ATTEMPTS } from "@/features/imports/adapters/gemini-retry-policy";
import { getGeminiApiKey, isTestRuntime } from "@/lib/env";
import { withCircuitBreaker, withTimeout } from "@/lib/resilience";

const MODEL_ID = "gemini-flash-lite-latest";

export type TypingReviewItem = Readonly<{
  id: string;
  userAnswer: string;
  correctAnswer: string;
}>;

export type TypingReviewResult = Readonly<{
  id: string;
  correct: boolean;
  reason: string | null;
}>;

const BATCH_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    results: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          correct: { type: Type.BOOLEAN },
          reason: { type: Type.STRING },
        },
        required: ["id", "correct", "reason"],
      },
    },
  },
  required: ["results"],
};

const MOCK_ENABLED = (process.env.CAPYSTUDY_TYPING_AI_MOCK ?? "").trim() === "1" && isTestRuntime();

function incrementMockCount(): void {
  const path = process.env.CAPYSTUDY_TYPING_AI_COUNT_FILE;
  if (!path) return;
  try {
    appendFileSync(path, "1\n", "utf8");
  } catch {
    // Test instrumentation must not affect grading.
  }
}

export function typingBatchCharacters(items: readonly TypingReviewItem[]): number {
  return items.reduce(
    (total, item) => total + item.userAnswer.length + item.correctAnswer.length,
    0,
  );
}

function buildPrompt(items: readonly TypingReviewItem[]): string {
  return `You are a strict but fair flashcard answer reviewer.

For every item, mark correct only when the student's answer is in the same language and semantically
equivalent to the expected answer. A synonym, abbreviation, equivalent phrasing, or minor spelling
mistake may be accepted. A translation into another language, different meaning, unrelated text, or an
empty answer must be rejected.

Return exactly one result for every input id. Never add, omit, or duplicate ids. Keep reasons short and
write them in Vietnamese; use an empty reason when correct.

Items (JSON):
${JSON.stringify(items)}`;
}

function validateBatchResponse(
  raw: unknown,
  items: readonly TypingReviewItem[],
): TypingReviewResult[] {
  if (!raw || typeof raw !== "object" || !("results" in raw)) {
    throw new Error("typing_ai_malformed_response");
  }
  const results = (raw as { results: unknown }).results;
  if (!Array.isArray(results) || results.length !== items.length) {
    throw new Error("typing_ai_incomplete_response");
  }

  const expected = new Set(items.map((item) => item.id));
  const seen = new Set<string>();
  const validated: TypingReviewResult[] = [];
  for (const value of results) {
    if (!value || typeof value !== "object") throw new Error("typing_ai_malformed_response");
    const item = value as Record<string, unknown>;
    const id = typeof item.id === "string" ? item.id : "";
    if (!expected.has(id) || seen.has(id) || typeof item.correct !== "boolean") {
      throw new Error("typing_ai_invalid_mapping");
    }
    if (typeof item.reason !== "string") throw new Error("typing_ai_malformed_response");
    seen.add(id);
    validated.push({
      id,
      correct: item.correct,
      reason: item.correct ? null : item.reason.trim() || null,
    });
  }
  if (seen.size !== expected.size) throw new Error("typing_ai_incomplete_response");
  return validated;
}

export class GeminiTypingBatchReviewer {
  constructor(private readonly callBudget: ProviderCallBudget) {}

  async review(items: readonly TypingReviewItem[]): Promise<TypingReviewResult[]> {
    if (items.length === 0) return [];
    const inputCharacters = typingBatchCharacters(items);

    if (MOCK_ENABLED) {
      await this.callBudget.beforeCall(inputCharacters);
      incrementMockCount();
      return items.map((item) => ({
        id: item.id,
        correct:
          item.userAnswer.trim().length > 0 &&
          item.userAnswer.trim().toLowerCase() === item.correctAnswer.trim().toLowerCase(),
        reason: null,
      }));
    }

    const apiKey = getGeminiApiKey();
    if (!apiKey) throw new Error("GEMINI_API_KEY is not configured.");
    const genAI = new GoogleGenAI({ apiKey });
    await this.callBudget.beforeCall(inputCharacters);

    const response = await withCircuitBreaker("gemini", () =>
      withTimeout(
        "gemini",
        genAI.models.generateContent({
          model: MODEL_ID,
          contents: [{ role: "user", parts: [{ text: buildPrompt(items) }] }],
          config: {
            responseMimeType: "application/json",
            responseSchema: BATCH_SCHEMA,
            httpOptions: { retryOptions: { attempts: GEMINI_RETRY_ATTEMPTS } },
          },
        }),
      ),
    );
    await this.callBudget.afterCall({
      inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
    });

    if (!response.text) throw new Error("typing_ai_empty_response");
    let parsed: unknown;
    try {
      parsed = JSON.parse(response.text);
    } catch {
      throw new Error("typing_ai_malformed_response");
    }
    return validateBatchResponse(parsed, items);
  }
}

/** Test-only helper retained for counter assertions without exposing file contents. */
export function readTypingMockCallCount(): number {
  const path = process.env.CAPYSTUDY_TYPING_AI_COUNT_FILE;
  if (!path) return 0;
  try {
    return existsSync(path)
      ? readFileSync(path, "utf8")
          .split("\n")
          .filter((line) => line.trim()).length
      : 0;
  } catch {
    return 0;
  }
}
