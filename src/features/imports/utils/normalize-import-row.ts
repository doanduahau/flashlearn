import { IMPORT_MAX_ROWS } from "@/lib/constants";
import type { ImportSummary } from "@/features/imports/types/import-types";

export function normalizeCell(value: string): string {
  return value.replace(/\r\n?/g, "\n").trim();
}

export function summarizeImport(
  rows: string[][],
  frontColumn: number,
  backColumn: number,
): ImportSummary {
  const summary: ImportSummary = { valid: 0, blank: 0, partial: 0, duplicate: 0, rows: [] };
  const seen = new Set<string>();
  for (const row of rows.slice(1)) {
    const front = normalizeCell(row[frontColumn] ?? "");
    const back = normalizeCell(row[backColumn] ?? "");
    if (!front && !back) {
      summary.blank += 1;
      continue;
    }
    if (!front || !back) {
      summary.partial += 1;
      continue;
    }
    const key = `${front}\u0000${back}`;
    if (seen.has(key)) {
      summary.duplicate += 1;
      continue;
    }
    seen.add(key);
    summary.rows.push({ front, back });
  }
  summary.valid = summary.rows.length;
  if (summary.valid > IMPORT_MAX_ROWS)
    throw new Error(`Tối đa ${IMPORT_MAX_ROWS.toLocaleString("vi-VN")} hàng hợp lệ.`);
  return summary;
}
