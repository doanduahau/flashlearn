import "server-only";

import { readFileSync, appendFileSync, writeFileSync, existsSync } from "node:fs";

import { GoogleGenAI, Type } from "@google/genai";

import { GEMINI_RETRY_ATTEMPTS } from "./gemini-retry-policy";
import type { SectionKind } from "../types/document-types";
import { getGeminiApiKey } from "@/lib/env";

const MODEL_ID = "gemini-flash-lite-latest";

const CLASSIFICATION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    kind: {
      type: Type.STRING,
      enum: ["flashcard_like", "prose", "mixed"],
    },
    confidence: { type: Type.NUMBER },
    reason: { type: Type.STRING },
  },
  required: ["kind", "confidence"],
};

const VALID_KINDS: Set<string> = new Set(["flashcard_like", "prose", "mixed"]);

function buildClassificationPrompt(sectionText: string): string {
  return `Classify the following educational content section by its STRUCTURE only. Your job is ONLY to determine the processing mode — do NOT generate flashcards, summarize content, or add outside knowledge.

CLASSIFICATION TARGETS:

- "flashcard_like": content already resembles explicit knowledge pairs (question/answer, term/definition, two-column structured data). This content can be converted to flashcards without AI generation.

- "prose": continuous explanatory/narrative educational text that requires semantic understanding to generate flashcards. Contains sentences, paragraphs, or prose describing concepts.

- "mixed": contains BOTH structured flashcard-like content AND substantial explanatory prose where treating the whole section as one type would lose quality.

RULES:
- Classify based on STRUCTURE and content pattern, not topic.
- Do NOT use outside knowledge.
- Do NOT alter the content.
- Be DECISIVE. Choose the single best category.
- Provide an honest confidence score (0-1).

Section content:

${sectionText}`;
}

export interface DocumentClassifier {
  classify(
    text: string,
  ): Promise<{ kind: SectionKind; confidence: number; deterministic: false; reason?: string }>;
}

// Test-only mock boundary. When FLASHLEARN_CLASSIFIER_MOCK=1 the classifier
// returns a fixed result instead of calling Gemini, and increments a file-backed
// counter so E2E tests can assert exact AI-call counts without hitting the real
// API. A file is used (rather than module state) because Next.js bundles server
// actions and route handlers into separate chunks that do not share module
// instances.
const MOCK_ENABLED = (process.env.FLASHLEARN_CLASSIFIER_MOCK ?? "").trim() === "1";

export const mockClassifierCount = {
  get calls(): number {
    const path = process.env.FLASHLEARN_CLASSIFIER_COUNT_FILE;
    if (!path) return 0;
    try {
      const raw = existsSync(path) ? readFileSync(path, "utf8") : "";
      return raw.split("\n").filter((l) => l.trim() !== "").length;
    } catch {
      return 0;
    }
  },
  increment(): void {
    const path = process.env.FLASHLEARN_CLASSIFIER_COUNT_FILE;
    if (!path) return;
    try {
      appendFileSync(path, "1\n", "utf8");
    } catch {
      // Best effort; test instrumentation only.
    }
  },
  reset(): void {
    const path = process.env.FLASHLEARN_CLASSIFIER_COUNT_FILE;
    if (!path) return;
    try {
      writeFileSync(path, "", "utf8");
    } catch {
      // Best effort; test instrumentation only.
    }
  },
};

export class GeminiDocumentClassifier implements DocumentClassifier {
  async classify(
    text: string,
  ): Promise<{ kind: SectionKind; confidence: number; deterministic: false; reason?: string }> {
    if (MOCK_ENABLED) {
      mockClassifierCount.increment();
      return {
        kind: "mixed",
        confidence: 0.8,
        deterministic: false,
        reason: "mock classifier",
      };
    }

    const apiKey = getGeminiApiKey();
    if (!apiKey) throw new Error("GEMINI_API_KEY not configured.");

    const genAI = new GoogleGenAI({ apiKey });
    const prompt = buildClassificationPrompt(text);

    const result = await genAI.models.generateContent({
      model: MODEL_ID,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: CLASSIFICATION_SCHEMA,
        httpOptions: { retryOptions: { attempts: GEMINI_RETRY_ATTEMPTS } },
      },
    });

    const raw = result.text;
    if (!raw) throw new Error("No AI response.");

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("Invalid AI response format.");
    }

    if (!parsed || typeof parsed !== "object") {
      throw new Error("Invalid AI response.");
    }

    const obj = parsed as Record<string, unknown>;
    const kindRaw = obj.kind;
    const confRaw = obj.confidence;
    const reason = typeof obj.reason === "string" ? obj.reason : undefined;

    if (typeof kindRaw !== "string" || !VALID_KINDS.has(kindRaw)) {
      throw new Error(`AI returned unknown kind: ${String(kindRaw)}`);
    }

    let confidence = typeof confRaw === "number" ? confRaw : 0.5;
    if (!Number.isFinite(confidence) || confidence < 0) confidence = 0;
    if (confidence > 1) confidence = 1;

    return {
      kind: kindRaw as SectionKind,
      confidence,
      deterministic: false,
      reason,
    };
  }
}
