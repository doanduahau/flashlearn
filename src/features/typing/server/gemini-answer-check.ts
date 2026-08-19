import "server-only";

import { existsSync, readFileSync, writeFileSync } from "node:fs";

import { GoogleGenAI, Type } from "@google/genai";

import { GEMINI_RETRY_ATTEMPTS } from "@/features/imports/adapters/gemini-retry-policy";
import { getGeminiApiKey } from "@/lib/env";
import { withCircuitBreaker, withTimeout } from "@/lib/resilience";
import { isTestRuntime } from "@/lib/env";

const MODEL_ID = "gemini-flash-lite-latest";

// Test-only mock boundary. When CAPYSTUDY_TYPING_AI_MOCK=1 the reviewer never
// calls Gemini: it accepts any non-empty answer that matches the correct one
// after normalization, and increments a file-backed counter so E2E tests can
// assert AI-reviewer usage without hitting the real API. A file is used (not
// module state) because Next.js bundles server actions into separate chunks.
const MOCK_ENABLED = (process.env.CAPYSTUDY_TYPING_AI_MOCK ?? "").trim() === "1" && isTestRuntime();

function mockCountFile(): string | null {
  const path = process.env.CAPYSTUDY_TYPING_AI_COUNT_FILE;
  return typeof path === "string" && path.length > 0 ? path : null;
}

function readMockCount(): number {
  const path = mockCountFile();
  if (!path) return 0;
  try {
    const raw = existsSync(path) ? readFileSync(path, "utf8") : "";
    return raw.split("\n").filter((line) => line.trim() !== "").length;
  } catch {
    return 0;
  }
}

function incrementMockCount(): void {
  const path = mockCountFile();
  if (!path) return;
  try {
    const next = readMockCount() + 1;
    writeFileSync(path, `${next}\n`, "utf8");
  } catch {
    // Best effort; test instrumentation only.
  }
}

const ANSWER_CHECK_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    correct: { type: Type.BOOLEAN },
    reason: { type: Type.STRING },
  },
  required: ["correct", "reason"],
};

function buildPrompt(userAnswer: string, correctAnswer: string): string {
  return `You are a fair teacher grading a student's answer in a flashcard quiz.

Your task: decide whether the student's answer should be marked CORRECT even though it does not exactly match the expected answer.

RULES:
- Mark CORRECT only when BOTH hold:
  (a) the student's answer is in the SAME LANGUAGE as the expected answer, AND
  (b) the student's answer is semantically equivalent: a synonym, an abbreviation, a different phrasing with the same meaning, or a minor spelling mistake that does not change the meaning.
- Mark INCORRECT when the languages differ, the meaning differs, or the answer is unrelated or empty.
- Be strict about language: translating the expected answer into another language is NOT correct.

Expected (correct) answer: "${correctAnswer}"

Student's answer: "${userAnswer}"

Respond with JSON only:
{"correct": true or false, "reason": "short Vietnamese explanation; empty string when correct"}`;
}

/**
 * AI reviewer — step 2 of typing grading. Only called for answers the local
 * matcher (isAnswerCorrect) marked wrong. Throws when the AI is unavailable or
 * returns an invalid payload; callers must fall back to the local result.
 */
export async function checkAnswerWithAI(input: {
  userAnswer: string;
  correctAnswer: string;
}): Promise<{ correct: boolean; reason: string | null }> {
  if (MOCK_ENABLED) {
    incrementMockCount();
    const normalizedUser = input.userAnswer.trim().toLowerCase();
    const normalizedCorrect = input.correctAnswer.trim().toLowerCase();
    return {
      correct: normalizedUser.length > 0 && normalizedUser === normalizedCorrect,
      reason: null,
    };
  }

  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const genAI = new GoogleGenAI({ apiKey });

  const result = await withCircuitBreaker("gemini", () =>
    withTimeout(
      "gemini",
      genAI.models.generateContent({
        model: MODEL_ID,
        contents: [
          { role: "user", parts: [{ text: buildPrompt(input.userAnswer, input.correctAnswer) }] },
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: ANSWER_CHECK_SCHEMA,
          httpOptions: {
            retryOptions: { attempts: GEMINI_RETRY_ATTEMPTS },
          },
        },
      }),
    ),
  );

  const responseText = result.text;
  if (!responseText) {
    throw new Error("AI không trả về phản hồi.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(responseText);
  } catch {
    throw new Error("Không thể đọc phản hồi từ AI.");
  }

  if (!parsed || typeof parsed !== "object" || !("correct" in parsed) || !("reason" in parsed)) {
    throw new Error("AI trả về dữ liệu không đúng định dạng.");
  }

  const { correct, reason } = parsed as { correct: unknown; reason: unknown };
  if (typeof correct !== "boolean" || typeof reason !== "string") {
    throw new Error("AI trả về dữ liệu không đúng định dạng.");
  }

  return { correct, reason: correct ? null : reason.trim() || null };
}
