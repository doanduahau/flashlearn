import type { DraftFlashcard } from "../types/import-types";

export type ColumnMapping = {
  frontColumn: number;
  backColumn: number;
};

export type ColumnDetectionResult =
  | { kind: "mapped"; mapping: ColumnMapping }
  | { kind: "ambiguous"; columns: string[] }
  | { kind: "single_column"; columnIndex: number; columnName: string };

const FRONT_HEADERS = ["front", "mặt trước", "question", "câu hỏi", "q", "term", "thuật ngữ"];
const BACK_HEADERS = ["back", "mặt sau", "answer", "câu trả lời", "a", "definition", "định nghĩa"];

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase();
}

export function detectColumns(headers: string[]): ColumnDetectionResult {
  const normalized = headers.map(normalizeHeader);
  const meaningful = headers.filter((h) => h.trim().length > 0);

  if (meaningful.length === 2) {
    return { kind: "mapped", mapping: { frontColumn: 0, backColumn: 1 } };
  }

  if (meaningful.length === 1) {
    return {
      kind: "single_column",
      columnIndex: 0,
      columnName: normalized[0] ?? headers[0] ?? "",
    };
  }

  if (meaningful.length > 3) {
    return { kind: "ambiguous", columns: headers.map((h) => h.trim()) };
  }

  let frontCol = -1;
  let backCol = -1;

  for (let i = 0; i < normalized.length; i += 1) {
    const h = normalized[i] ?? "";
    if (frontCol === -1 && FRONT_HEADERS.includes(h)) {
      frontCol = i;
    } else if (backCol === -1 && BACK_HEADERS.includes(h)) {
      backCol = i;
    }
  }

  if (frontCol !== -1 && backCol !== -1 && frontCol !== backCol) {
    return { kind: "mapped", mapping: { frontColumn: frontCol, backColumn: backCol } };
  }

  return { kind: "ambiguous", columns: headers.map((h) => h.trim()) };
}

export function applyMapping(rows: string[][], mapping: ColumnMapping): DraftFlashcard[] {
  const cards: DraftFlashcard[] = [];
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    if (!row) continue;
    const front = (row[mapping.frontColumn] ?? "").trim();
    const back = (row[mapping.backColumn] ?? "").trim();
    cards.push({ front, back, sourceRow: i + 1 });
  }
  return cards;
}
