import type { DraftFlashcard } from "../types/import-types";
import { parseWorkbook, validateImportFile } from "../utils/parse-workbook";
import { normalizeCell } from "../utils/normalize-import-row";

export type ExcelAdapterOptions = {
  sheetIndex: number;
  frontColumn: number;
  backColumn: number;
};

export async function excelToDraftCards(
  file: File,
  options: ExcelAdapterOptions,
): Promise<DraftFlashcard[]> {
  const validationError = validateImportFile(file);
  if (validationError) throw new Error(validationError);

  const sheets = await parseWorkbook(file);
  const sheet = sheets[options.sheetIndex];
  if (!sheet) throw new Error("Không tìm thấy sheet đã chọn.");

  return sheetToDraftCards(sheet, options.frontColumn, options.backColumn);
}

export function sheetToDraftCards(
  sheet: { rows: string[][] },
  frontColumn: number,
  backColumn: number,
): DraftFlashcard[] {
  const dataRows = sheet.rows.slice(1);
  return dataRows.map((row, index) => ({
    front: normalizeCell(row[frontColumn] ?? ""),
    back: normalizeCell(row[backColumn] ?? ""),
    sourceRow: index + 2,
  }));
}

export { parseWorkbook, validateImportFile };
