import { read, utils } from "xlsx";

import type { ParsedSheet } from "@/features/imports/types/import-types";

export function validateImportFile(file: File): string | null {
  const supported =
    file.name.toLowerCase().endsWith(".xlsx") || file.name.toLowerCase().endsWith(".csv");
  if (!supported) return "Chỉ hỗ trợ tệp .xlsx hoặc .csv.";
  if (file.size > 5 * 1024 * 1024) return "Tệp không được lớn hơn 5 MB.";
  return null;
}

export async function parseWorkbook(file: File): Promise<ParsedSheet[]> {
  const fileBuffer = await file.arrayBuffer();
  const isCsv = file.name.toLowerCase().endsWith(".csv");
  const workbook = read(
    isCsv ? new TextDecoder("utf-8").decode(fileBuffer) : new Uint8Array(fileBuffer),
    {
      type: isCsv ? "string" : "array",
      cellFormula: false,
      cellHTML: false,
    },
  );
  return workbook.SheetNames.map((name) => ({
    name,
    rows: utils
      .sheet_to_json<string[]>(workbook.Sheets[name], {
        header: 1,
        defval: "",
        raw: false,
        blankrows: true,
      })
      .map((row) => row.map((cell) => String(cell ?? ""))),
  }));
}
