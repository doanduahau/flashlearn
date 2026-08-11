import "server-only";

import { GoogleGenAI, Type } from "@google/genai";

import { GEMINI_RETRY_ATTEMPTS } from "./gemini-retry-policy";
import type { DraftFlashcard } from "../types/import-types";
import type { FlashcardGenerationProvider } from "../types/import-types";
import { CARD_TEXT_MAX_LENGTH, GEMINI_MAX_OUTPUT_CARDS } from "@/lib/constants";
import { getGeminiApiKey } from "@/lib/env";

const MODEL_ID = "gemini-flash-lite-latest";

const GEMINI_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    cards: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          front: { type: Type.STRING },
          back: { type: Type.STRING },
        },
        required: ["front", "back"],
      },
      maxItems: GEMINI_MAX_OUTPUT_CARDS,
    },
  },
  required: ["cards"],
};

function buildPrompt(text: string): string {
  const maxCards = GEMINI_MAX_OUTPUT_CARDS;
  return `You are an educational flashcard generator. Your task is to transform the provided source content into flashcards for learning.

RULES:
- Use ONLY information present in the source content. Do not introduce outside knowledge.
- Preserve the source language (Vietnamese, English, etc.) exactly as written.
- Each card must have a concise front (question/term) and an accurate back (answer/definition).
- One meaningful concept per card.
- Avoid redundant or trivial cards that add no learning value.
- Do not fabricate facts or generate unsupported explanations.
- Generate at most ${maxCards} cards.

Source content:

${text}`;
}

export class GeminiFlashcardGenerationProvider implements FlashcardGenerationProvider {
  async generateCards(input: { text: string }): Promise<DraftFlashcard[]> {
    const result = await this.generateCardsWithStats(input);
    return result.cards;
  }

  async generateCardsWithStats(input: {
    text: string;
  }): Promise<{ cards: DraftFlashcard[]; discardedCount: number }> {
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured.");
    }

    const genAI = new GoogleGenAI({ apiKey });

    const prompt = buildPrompt(input.text);

    const result = await genAI.models.generateContent({
      model: MODEL_ID,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: GEMINI_RESPONSE_SCHEMA,
        httpOptions: {
          retryOptions: { attempts: GEMINI_RETRY_ATTEMPTS },
        },
      },
    });

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

    if (!parsed || typeof parsed !== "object" || !("cards" in parsed)) {
      throw new Error("AI trả về dữ liệu không đúng định dạng.");
    }

    const cards = (parsed as { cards: unknown }).cards;
    if (!Array.isArray(cards)) {
      throw new Error("AI trả về dữ liệu không đúng định dạng.");
    }

    const draftCards: DraftFlashcard[] = [];
    let discardedCount = 0;
    for (const card of cards) {
      if (!card || typeof card !== "object") {
        discardedCount += 1;
        continue;
      }
      const c = card as Record<string, unknown>;
      const front = typeof c.front === "string" ? c.front.trim() : "";
      const back = typeof c.back === "string" ? c.back.trim() : "";
      if (!front || !back) {
        discardedCount += 1;
        continue;
      }
      if (front.length > CARD_TEXT_MAX_LENGTH || back.length > CARD_TEXT_MAX_LENGTH) {
        discardedCount += 1;
        continue;
      }
      draftCards.push({ front, back });
    }

    if (draftCards.length === 0) {
      throw new Error("AI không tạo được thẻ nào từ nội dung này.");
    }

    return { cards: draftCards, discardedCount };
  }
}
