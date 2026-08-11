import type { ExtractedDocumentBlock } from "../types/document-types";
import type { SectionKind } from "../types/document-types";
import type { BuiltSection } from "./section-builder";

export type ClassificationResult = {
  kind: SectionKind;
  confidence: number;
  deterministic: boolean;
  reason?: string;
};

export const DETERMINISTIC_CONFIDENCE_THRESHOLD = 0.65;

const FRONT_HEADERS = ["question", "câu hỏi", "q", "front", "mặt trước", "term", "thuật ngữ"];
const BACK_HEADERS = ["answer", "câu trả lời", "a", "back", "mặt sau", "definition", "định nghĩa"];

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase();
}

interface SectionMetrics {
  tableCount: number;
  paragraphCount: number;
  headingCount: number;
  totalChars: number;
  paragraphChars: number;
  tableRows: number;
  tableHasColumnPair: boolean;
  tableRecognizedHeaders: boolean;
  tableHeaderlessTwoColumns: boolean;
}

function computeMetrics(section: BuiltSection): SectionMetrics {
  let paragraphCount = 0;
  let paragraphChars = 0;
  let totalChars = 0;
  let tableCount = 0;
  let headingCount = 0;
  let tableRows = 0;
  let tableHasColumnPair = false;
  let tableRecognizedHeaders = false;
  let tableHeaderlessTwoColumns = false;

  for (const block of section.blocks) {
    if (block.type === "paragraph") {
      paragraphCount += 1;
      const len = block.text.length;
      paragraphChars += len;
      totalChars += len;
    } else if (block.type === "heading") {
      headingCount += 1;
      totalChars += block.text.length;
    } else if (block.type === "table") {
      tableCount += 1;
      tableRows += block.rows.length;
      for (const row of block.rows) {
        for (const cell of row) totalChars += cell.length;
      }

      if (block.rows.length >= 2 && block.rows.every((r) => r.length === 2)) {
        const headers = block.rows[0]?.map(normalizeHeader) ?? [];
        const frontIdx = headers.findIndex((h) => FRONT_HEADERS.includes(h));
        const backIdx = headers.findIndex((h) => BACK_HEADERS.includes(h));
        if (frontIdx !== -1 && backIdx !== -1 && frontIdx !== backIdx) {
          tableHasColumnPair = true;
          tableRecognizedHeaders = true;
        } else {
          const nonEmptyRows = block.rows.filter((r) => r.every((c) => c.trim().length > 0));
          if (nonEmptyRows.length >= 2) {
            tableHasColumnPair = true;
            tableHeaderlessTwoColumns = true;
          }
        }
      }
    }
  }

  if (section.heading) totalChars += section.heading.length;

  return {
    tableCount,
    paragraphCount,
    headingCount,
    totalChars,
    paragraphChars,
    tableRows,
    tableHasColumnPair,
    tableRecognizedHeaders,
    tableHeaderlessTwoColumns,
  };
}

export function classifySection(section: BuiltSection): ClassificationResult {
  if (section.blocks.length === 0 && !section.heading) {
    return { kind: "empty", confidence: 1, deterministic: true, reason: "no content" };
  }

  const m = computeMetrics(section);

  if (m.totalChars === 0) {
    return { kind: "empty", confidence: 1, deterministic: true, reason: "whitespace only" };
  }

  // Mixed: has both structured content and substantial prose.
  if (m.tableCount >= 1 && m.tableHasColumnPair && m.paragraphCount >= 1 && m.paragraphChars > 40) {
    return {
      kind: "mixed",
      confidence: 0.62,
      deterministic: true,
      reason: "structured table with surrounding prose",
    };
  }

  // Strong flashcard-like: exactly one table with recognized pair headers.
  if (m.tableCount === 1 && m.tableRecognizedHeaders && m.tableRows >= 2) {
    return {
      kind: "flashcard_like",
      confidence: 0.92,
      deterministic: true,
      reason: "table with explicit pair headers",
    };
  }

  // Good flashcard-like: exactly one headerless 2-column table with multiple rows.
  if (
    m.tableCount === 1 &&
    m.tableHeaderlessTwoColumns &&
    m.tableRows >= 3 &&
    m.paragraphChars < m.totalChars * 0.3
  ) {
    return {
      kind: "flashcard_like",
      confidence: 0.78,
      deterministic: true,
      reason: "2-column table with multiple data rows",
    };
  }

  // Clear prose: paragraphs dominate, no table.
  if (m.tableCount === 0 && m.paragraphCount >= 1 && m.paragraphChars > 0) {
    const avgPara = m.paragraphChars / m.paragraphCount;
    return {
      kind: "prose",
      confidence: avgPara > 50 ? 0.85 : 0.68,
      deterministic: true,
      reason: `paragraph-dominant content (${m.paragraphCount} paragraphs)`,
    };
  }

  // Weak flashcard-like: small headerless 2-column table.
  if (m.tableCount === 1 && m.tableHeaderlessTwoColumns && m.tableRows >= 2) {
    return {
      kind: "flashcard_like",
      confidence: 0.58,
      deterministic: true,
      reason: "small 2-column table",
    };
  }

  // Low-confidence fallback: can't reliably determine.
  return {
    kind: "mixed",
    confidence: 0.4,
    deterministic: true,
    reason: "content structure is ambiguous",
  };
}
