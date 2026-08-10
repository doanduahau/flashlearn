import type { DraftFlashcard } from "../types/import-types";
import type { FlashcardGenerationProvider } from "../types/import-types";
import { detectColumns, applyMapping } from "../utils/detect-columns";
import type { ColumnDetectionResult } from "../utils/detect-columns";

export type GoogleSheetMeta = {
  spreadsheetTitle: string;
  sheets: Array<{ title: string; sheetId: number; index: number }>;
};

export type SheetData = {
  headers: string[];
  rows: string[][];
  rowCount: number;
};

export type GoogleSheetsAdapterResult =
  | {
      kind: "structured";
      cards: DraftFlashcard[];
      mapping: { frontColumn: number; backColumn: number };
    }
  | { kind: "needs_mapping"; columns: string[]; sheetData: SheetData }
  | { kind: "single_column_semantic"; text: string; columnName: string }
  | { kind: "error"; message: string };

export function adaptSheetData(
  sheetData: SheetData,
  preferredMapping?: { frontColumn: number; backColumn: number },
): GoogleSheetsAdapterResult {
  const { headers, rows } = sheetData;

  if (rows.length === 0) {
    return { kind: "error", message: "Bảng tính không có dữ liệu." };
  }

  if (preferredMapping) {
    const cards = applyMapping(rows, preferredMapping);
    return { kind: "structured", cards, mapping: preferredMapping };
  }

  const detection = detectColumns(headers);

  if (detection.kind === "mapped") {
    const cards = applyMapping(rows, detection.mapping);
    return { kind: "structured", cards, mapping: detection.mapping };
  }

  if (detection.kind === "single_column") {
    const colIdx = detection.columnIndex;
    const text = rows
      .map((row) => (row[colIdx] ?? "").trim())
      .filter((val) => val.length > 0)
      .join("\n");
    return { kind: "single_column_semantic", text, columnName: detection.columnName };
  }

  return { kind: "needs_mapping", columns: headers.map((h) => h.trim()), sheetData };
}

export async function semanticSheetToCards(
  text: string,
  provider: FlashcardGenerationProvider,
): Promise<DraftFlashcard[]> {
  return provider.generateCards({ text });
}
