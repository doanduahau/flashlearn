"use server";

import { readFileSync, appendFileSync, existsSync } from "node:fs";

import type {
  DraftFlashcard,
  FlashcardGenerationProvider,
} from "@/features/imports/types/import-types";
import type {
  AnalyzedDocument,
  AnalyzedDocumentSection,
  ExtractedDocumentBlock,
} from "@/features/imports/types/document-types";
import { GeminiFlashcardGenerationProvider } from "@/features/imports/adapters/gemini-provider";
import { validateDraftCards } from "@/features/imports/utils/validate-draft-cards";
import {
  DOCUMENT_GENERATION_MAX_AI_REQUESTS,
  GEMINI_MAX_OUTPUT_CARDS,
  IMPORT_MAX_ROWS,
} from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";

// ─── Test-only generation mock (env-gated) ─────────────────────────────────

const GEN_MOCK_ENABLED = (process.env.FLASHLEARN_GENERATION_MOCK ?? "").trim() === "1";

const genCounter = {
  get calls(): number {
    const path = process.env.FLASHLEARN_GENERATION_COUNT_FILE;
    if (!path) return 0;
    try {
      const raw = existsSync(path) ? readFileSync(path, "utf8") : "";
      return raw.split("\n").filter((l) => l.trim() !== "").length;
    } catch {
      return 0;
    }
  },
  increment(): void {
    const path = process.env.FLASHLEARN_GENERATION_COUNT_FILE;
    if (!path) return;
    try {
      appendFileSync(path, "1\n", "utf8");
    } catch {
      /* best effort */
    }
  },
};

async function mockGenerateCards(_input: { text: string }): Promise<DraftFlashcard[]> {
  genCounter.increment();
  return [
    { front: "Mock question from document", back: "Mock answer from document" },
    { front: "Another mock question", back: "Another mock answer" },
  ];
}

// ─── Types ────────────────────────────────────────────────────────────────

type GenerationMetrics = {
  sourceChars: number;
  deterministicChars: number;
  aiInputChars: number;
  deterministicCards: number;
  aiGeneratedCards: number;
  aiRequests: number;
};

type GenerationResult =
  | {
      cards: DraftFlashcard[];
      metrics: GenerationMetrics;
      warnings: string[];
    }
  | { error: string };

// ─── Deterministic conversion helpers ─────────────────────────────────────

const FRONT_LABELS = new Set([
  "front",
  "mặt trước",
  "question",
  "câu hỏi",
  "q",
  "term",
  "thuật ngữ",
]);
const BACK_LABELS = new Set([
  "back",
  "mặt sau",
  "answer",
  "câu trả lời",
  "a",
  "definition",
  "định nghĩa",
]);

function normalizeLabel(value: string): string {
  return value.trim().toLowerCase();
}

function isHeaderRow(row: string[]): boolean {
  if (row.length !== 2) return false;
  const a = normalizeLabel(row[0] ?? "");
  const b = normalizeLabel(row[1] ?? "");
  return FRONT_LABELS.has(a) && BACK_LABELS.has(b);
}

function convertTable(table: ExtractedDocumentBlock): DraftFlashcard[] {
  if (table.type !== "table") return [];
  const rows = table.rows;
  if (rows.length === 0) return [];
  const start = rows.length >= 1 && isHeaderRow(rows[0]!) ? 1 : 0;
  const cards: DraftFlashcard[] = [];
  for (let i = start; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 2) continue;
    const front = (row[0] ?? "").trim();
    const back = (row[1] ?? "").trim();
    if (!front || !back) continue;
    cards.push({ front, back });
  }
  return cards;
}

function blockText(block: ExtractedDocumentBlock): string {
  if (block.type === "heading" || block.type === "paragraph") return block.text;
  if (block.type === "table") {
    return block.rows.map((r) => r.join(" | ")).join("\n");
  }
  return "";
}

// ─── Section processors ───────────────────────────────────────────────────

function processFlashcardLike(section: AnalyzedDocumentSection): {
  cards: DraftFlashcard[];
  chars: number;
} {
  const cards: DraftFlashcard[] = [];
  let chars = 0;
  for (const block of section.blocks) {
    if (block.type === "table") {
      const tableCards = convertTable(block);
      for (const c of tableCards) {
        cards.push(c);
        chars += c.front.length + c.back.length;
      }
    }
  }
  return { cards, chars };
}

async function processProse(
  section: AnalyzedDocumentSection,
  provider: FlashcardGenerationProvider,
): Promise<{ cards: DraftFlashcard[]; aiInputChars: number }> {
  const text = section.blocks
    .map(blockText)
    .filter((t) => t.length > 0)
    .join("\n\n");
  if (text.length === 0) return { cards: [], aiInputChars: 0 };
  const cards = await provider.generateCards({ text });
  return { cards: cards.slice(0, GEMINI_MAX_OUTPUT_CARDS), aiInputChars: text.length };
}

async function processMixed(
  section: AnalyzedDocumentSection,
  provider: FlashcardGenerationProvider,
): Promise<{ cards: DraftFlashcard[]; aiInputChars: number; detPre: number; aiPre: number }> {
  let aiInputChars = 0;
  let detPre = 0;
  let aiPre = 0;
  const allCards: DraftFlashcard[] = [];
  const proseBlocks: string[] = [];

  for (const block of section.blocks) {
    if (block.type === "table") {
      const tableCards = convertTable(block);
      allCards.push(...tableCards);
      detPre += tableCards.length;
    } else {
      const text = blockText(block);
      if (text.length > 0) proseBlocks.push(text);
    }
  }

  if (proseBlocks.length > 0) {
    const text = proseBlocks.join("\n\n");
    aiInputChars += text.length;
    const genCards = await provider.generateCards({ text });
    allCards.push(...genCards.slice(0, GEMINI_MAX_OUTPUT_CARDS));
    aiPre += genCards.length;
  }

  return { cards: allCards, aiInputChars, detPre, aiPre };
}

// ─── Deduplication ────────────────────────────────────────────────────────

function normalizeCardKey(front: string, back: string): string {
  return `${front.replace(/\s+/g, " ").trim()}\u0000${back.replace(/\s+/g, " ").trim()}`;
}

function deduplicateCards(cards: DraftFlashcard[]): DraftFlashcard[] {
  const seen = new Set<string>();
  const out: DraftFlashcard[] = [];
  for (const card of cards) {
    const key = normalizeCardKey(card.front, card.back);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(card);
  }
  return out;
}

// ─── Main orchestrator ────────────────────────────────────────────────────

export async function generateDocumentCards(analyzed: AnalyzedDocument): Promise<GenerationResult> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return { error: "Phiên đăng nhập đã hết hạn." };

  if (!analyzed || typeof analyzed !== "object" || !Array.isArray(analyzed.sections)) {
    return { error: "Dữ liệu phân tích không hợp lệ." };
  }

  const provider: FlashcardGenerationProvider = GEN_MOCK_ENABLED
    ? { generateCards: mockGenerateCards }
    : new GeminiFlashcardGenerationProvider();

  const allCards: DraftFlashcard[] = [];
  let detCardCount = 0;
  let aiCardCount = 0;
  const metrics: GenerationMetrics = {
    sourceChars: 0,
    deterministicChars: 0,
    aiInputChars: 0,
    deterministicCards: 0,
    aiGeneratedCards: 0,
    aiRequests: 0,
  };
  const warnings: string[] = [];

  for (const section of analyzed.sections) {
    for (const block of section.blocks) {
      metrics.sourceChars += blockText(block).length;
    }

    if (section.kind === "empty") continue;

    if (section.kind === "flashcard_like") {
      const result = processFlashcardLike(section);
      allCards.push(...result.cards);
      metrics.deterministicChars += result.chars;
      detCardCount += result.cards.length;
    } else if (section.kind === "prose") {
      if (metrics.aiRequests >= DOCUMENT_GENERATION_MAX_AI_REQUESTS) {
        warnings.push(`Đã đạt giới hạn ${DOCUMENT_GENERATION_MAX_AI_REQUESTS} yêu cầu AI.`);
        continue;
      }
      metrics.aiRequests += 1;
      try {
        const result = await processProse(section, provider);
        allCards.push(...result.cards);
        metrics.aiInputChars += result.aiInputChars;
        aiCardCount += result.cards.length;
      } catch {
        warnings.push("Không thể tạo thẻ cho một mục văn bản (AI không khả dụng).");
      }
    } else if (section.kind === "mixed") {
      if (metrics.aiRequests >= DOCUMENT_GENERATION_MAX_AI_REQUESTS) {
        const det = processFlashcardLike(section);
        allCards.push(...det.cards);
        metrics.deterministicChars += det.chars;
        detCardCount += det.cards.length;
        warnings.push(`Đã đạt giới hạn ${DOCUMENT_GENERATION_MAX_AI_REQUESTS} yêu cầu AI.`);
        continue;
      }
      metrics.aiRequests += 1;
      try {
        const result = await processMixed(section, provider);
        allCards.push(...result.cards);
        metrics.aiInputChars += result.aiInputChars;
        detCardCount += result.detPre;
        aiCardCount += result.aiPre;
      } catch {
        const det = processFlashcardLike(section);
        allCards.push(...det.cards);
        metrics.deterministicChars += det.chars;
        detCardCount += det.cards.length;
        warnings.push(
          "Không thể tạo thẻ cho phần văn bản của một mục hỗn hợp (AI không khả dụng).",
        );
      }
    }
  }

  const deduped = deduplicateCards(allCards);
  const validated = validateDraftCards(deduped.slice(0, IMPORT_MAX_ROWS));

  metrics.deterministicCards = detCardCount;
  metrics.aiGeneratedCards = aiCardCount;

  return {
    cards: validated.cards,
    metrics,
    warnings: warnings.length > 0 ? warnings : [],
  };
}
