import type { DraftFlashcard } from "../types/import-types";

export type ColumnMapping = {
  frontColumn: number;
  backColumn: number;
};

export type MeaningfulColumn = {
  index: number;
  name: string;
};

export type ColumnDetectionResult =
  | { kind: "mapped"; mapping: ColumnMapping }
  | { kind: "ambiguous"; columns: MeaningfulColumn[] }
  | { kind: "single_column"; columnIndex: number; columnName: string };

const FRONT_HEADERS = ["front", "mặt trước", "question", "câu hỏi", "q", "term", "thuật ngữ"];
const BACK_HEADERS = ["back", "mặt sau", "answer", "câu trả lời", "a", "definition", "định nghĩa"];

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase();
}

function meaningfulColumns(headers: string[]): MeaningfulColumn[] {
  const result: MeaningfulColumn[] = [];
  for (let i = 0; i < headers.length; i += 1) {
    const name = headers[i]?.trim() ?? "";
    if (name.length > 0) result.push({ index: i, name });
  }
  return result;
}

export function detectColumns(headers: string[]): ColumnDetectionResult {
  const meaningful = meaningfulColumns(headers);

  if (meaningful.length === 2) {
    return {
      kind: "mapped",
      mapping: { frontColumn: meaningful[0]!.index, backColumn: meaningful[1]!.index },
    };
  }

  if (meaningful.length === 1) {
    const col = meaningful[0]!;
    return { kind: "single_column", columnIndex: col.index, columnName: col.name };
  }

  if (meaningful.length > 3) {
    return { kind: "ambiguous", columns: meaningful };
  }

  let frontCol = -1;
  let backCol = -1;

  for (const col of meaningful) {
    const h = normalizeHeader(col.name);
    if (frontCol === -1 && FRONT_HEADERS.includes(h)) {
      frontCol = col.index;
    } else if (backCol === -1 && BACK_HEADERS.includes(h)) {
      backCol = col.index;
    }
  }

  if (frontCol !== -1 && backCol !== -1 && frontCol !== backCol) {
    return { kind: "mapped", mapping: { frontColumn: frontCol, backColumn: backCol } };
  }

  return { kind: "ambiguous", columns: meaningful };
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
