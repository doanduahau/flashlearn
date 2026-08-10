import type { DraftFlashcard } from "../types/import-types";
import type { FlashcardGenerationProvider } from "../types/import-types";
import { applyMapping, detectColumns, type MeaningfulColumn } from "../utils/detect-columns";
import type { ColumnMapping } from "../utils/detect-columns";

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
  | { kind: "needs_mapping"; columns: MeaningfulColumn[] }
  | { kind: "single_column_semantic"; text: string; columnName: string }
  | { kind: "error"; message: string };

export function adaptSheetData(
  sheetData: SheetData,
  preferredMapping?: ColumnMapping,
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

  return { kind: "needs_mapping", columns: detection.columns };
}

export async function semanticSheetToCards(
  text: string,
  provider: FlashcardGenerationProvider,
): Promise<DraftFlashcard[]> {
  return provider.generateCards({ text });
}
