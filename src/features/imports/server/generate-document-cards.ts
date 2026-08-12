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
  DOCUMENT_GENERATION_MAX_INPUT_CHARS,
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
  const failPath = process.env.FLASHLEARN_GENERATION_MOCK_FAIL_FILE;
  const shouldFail =
    failPath && existsSync(failPath) && readFileSync(failPath, "utf8").trim() === "1";
  if (shouldFail) {
    throw new Error("Mock generation failure");
  }
  return [
    {
      front: "RAM là gì?",
      back: "Tiến trình là gì? Người sử dụng dữ liệu trong hệ thống.",
    },
    { front: "Đây là thẻ thử nghiệm", back: "Nội dung Unicode phải được giữ nguyên." },
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
      limitExceeded: boolean;
    }
  | { error: string };

type ProviderWithStats = {
  generateCards(input: { text: string }): Promise<DraftFlashcard[]>;
  generateCardsWithStats?(input: {
    text: string;
  }): Promise<{ cards: DraftFlashcard[]; discardedCount: number }>;
};

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

// ─── Semantic chunking ────────────────────────────────────────────────────

const CHUNK_LIMIT = DOCUMENT_GENERATION_MAX_INPUT_CHARS;

type ChunkResult = {
  chunks: string[];
  oversizedBlocks: string[];
};

/**
 * Groups prose block texts into chunks no larger than CHUNK_LIMIT, splitting on
 * block boundaries (never inside a block). A single block that alone exceeds the
 * limit is returned as oversized rather than silently cut.
 */
function chunkProseBlocks(blocks: string[]): ChunkResult {
  const chunks: string[] = [];
  const oversizedBlocks: string[] = [];
  let current: string | null = null;

  for (const block of blocks) {
    if (block.length > CHUNK_LIMIT) {
      if (current) {
        chunks.push(current);
        current = null;
      }
      oversizedBlocks.push(block);
      continue;
    }
    const candidate: string = current ? `${current}\n\n${block}` : block;
    if (candidate.length > CHUNK_LIMIT) {
      if (current) chunks.push(current);
      current = block;
    } else {
      current = candidate;
    }
  }

  if (current) chunks.push(current);
  return { chunks, oversizedBlocks };
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

async function generateProseChunk(
  text: string,
  provider: ProviderWithStats,
): Promise<{ cards: DraftFlashcard[]; discarded: number }> {
  if (provider.generateCardsWithStats) {
    const result = await provider.generateCardsWithStats({ text });
    return {
      cards: result.cards.slice(0, GEMINI_MAX_OUTPUT_CARDS),
      discarded: result.discardedCount,
    };
  }
  const cards = await provider.generateCards({ text });
  return { cards: cards.slice(0, GEMINI_MAX_OUTPUT_CARDS), discarded: 0 };
}

async function processProse(
  section: AnalyzedDocumentSection,
  provider: ProviderWithStats,
): Promise<{
  cards: DraftFlashcard[];
  aiInputChars: number;
  warnings: string[];
}> {
  const texts = section.blocks.map(blockText).filter((t) => t.length > 0);
  if (texts.length === 0) return { cards: [], aiInputChars: 0, warnings: [] };

  const { chunks, oversizedBlocks } = chunkProseBlocks(texts);
  const warnings: string[] = [];
  const cards: DraftFlashcard[] = [];
  let aiInputChars = 0;

  for (const chunk of chunks) {
    aiInputChars += chunk.length;
    const result = await generateProseChunk(chunk, provider);
    cards.push(...result.cards);
    if (result.discarded > 0) {
      warnings.push(`Bỏ qua ${result.discarded} thẻ AI không hợp lệ trong một mục văn bản.`);
    }
  }

  for (const oversized of oversizedBlocks) {
    warnings.push(
      `Một đoạn văn quá dài để xử lý (${oversized.length} ký tự). Không thể tạo thẻ cho đoạn này.`,
    );
  }

  return { cards, aiInputChars, warnings };
}

async function processMixed(
  section: AnalyzedDocumentSection,
  provider: ProviderWithStats,
): Promise<{
  cards: DraftFlashcard[];
  aiInputChars: number;
  detPre: number;
  aiPre: number;
  warnings: string[];
}> {
  const warnings: string[] = [];
  const allCards: DraftFlashcard[] = [];
  let aiInputChars = 0;
  let detPre = 0;
  let aiPre = 0;

  // Walk blocks in ORIGINAL order. Group adjacent prose blocks, but emit
  // deterministic table cards at the position where the table appears.
  let proseGroup: string[] = [];

  const flushProse = async (): Promise<void> => {
    if (proseGroup.length === 0) return;
    const { chunks, oversizedBlocks } = chunkProseBlocks(proseGroup);
    for (const chunk of chunks) {
      aiInputChars += chunk.length;
      const result = await generateProseChunk(chunk, provider);
      allCards.push(...result.cards);
      aiPre += result.cards.length;
      if (result.discarded > 0) {
        warnings.push(`Bỏ qua ${result.discarded} thẻ AI không hợp lệ trong một mục hỗn hợp.`);
      }
    }
    for (const oversized of oversizedBlocks) {
      warnings.push(
        `Một đoạn văn quá dài để xử lý (${oversized.length} ký tự) trong mục hỗn hợp. Không thể tạo thẻ cho đoạn này.`,
      );
    }
    proseGroup = [];
  };

  for (const block of section.blocks) {
    if (block.type === "table") {
      await flushProse();
      const tableCards = convertTable(block);
      allCards.push(...tableCards);
      detPre += tableCards.length;
    } else {
      const text = blockText(block);
      if (text.length > 0) proseGroup.push(text);
    }
  }

  await flushProse();

  return { cards: allCards, aiInputChars, detPre, aiPre, warnings };
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

  const provider: ProviderWithStats = GEN_MOCK_ENABLED
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
        warnings.push(...result.warnings);
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
        warnings.push(...result.warnings);
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

  // No silent truncation: if the document exceeds the canonical limit, surface it.
  if (deduped.length > IMPORT_MAX_ROWS) {
    metrics.deterministicCards = detCardCount;
    metrics.aiGeneratedCards = aiCardCount;
    return {
      cards: deduped,
      metrics,
      warnings: [
        ...warnings,
        `Tài liệu tạo ra ${deduped.length} thẻ, vượt quá mức tối đa ${IMPORT_MAX_ROWS}. Không thể tiếp tục import.`,
      ],
      limitExceeded: true,
    };
  }

  const validated = validateDraftCards(deduped);

  metrics.deterministicCards = detCardCount;
  metrics.aiGeneratedCards = aiCardCount;

  return {
    cards: validated.cards,
    metrics,
    warnings: warnings.length > 0 ? warnings : [],
    limitExceeded: false,
  };
}
