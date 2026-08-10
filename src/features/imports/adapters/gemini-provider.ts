import "server-only";

import type { Schema } from "@google/generative-ai";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

import type { DraftFlashcard } from "../types/import-types";
import type { FlashcardGenerationProvider } from "../types/import-types";
import { CARD_TEXT_MAX_LENGTH, GEMINI_MAX_OUTPUT_CARDS } from "@/lib/constants";
import { getGeminiApiKey } from "@/lib/env";

const MODEL_ID = "gemini-2.5-flash-lite";

const GEMINI_RESPONSE_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    cards: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          front: { type: SchemaType.STRING },
          back: { type: SchemaType.STRING },
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
  async generateCards({ text }: { text: string }): Promise<DraftFlashcard[]> {
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured.");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: MODEL_ID });

    const prompt = buildPrompt(text);

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: GEMINI_RESPONSE_SCHEMA,
      },
    });

    const responseText = result.response.text();
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
    for (const card of cards) {
      if (!card || typeof card !== "object") continue;
      const c = card as Record<string, unknown>;
      const front = typeof c.front === "string" ? c.front.trim() : "";
      const back = typeof c.back === "string" ? c.back.trim() : "";
      if (!front || !back) continue;
      if (front.length > CARD_TEXT_MAX_LENGTH || back.length > CARD_TEXT_MAX_LENGTH) continue;
      draftCards.push({ front, back });
    }

    if (draftCards.length === 0) {
      throw new Error("AI không tạo được thẻ nào từ nội dung này.");
    }

    return draftCards;
  }
}
