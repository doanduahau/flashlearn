import type { StudySourceRow } from "@/features/study/types/study-types";

export function collectUniqueRows(
  groups: readonly (readonly StudySourceRow[])[],
): StudySourceRow[] {
  const byId = new Map<string, StudySourceRow>();
  for (const group of groups) {
    for (const row of group) {
      if (!byId.has(row.id)) byId.set(row.id, row);
    }
  }
  return [...byId.values()];
}

export function compareRows(a: StudySourceRow, b: StudySourceRow): number {
  return a.set_id.localeCompare(b.set_id) || a.position - b.position || a.id.localeCompare(b.id);
}

export function capRows(
  rows: StudySourceRow[],
  max: number,
): { rows: StudySourceRow[]; truncated: boolean } {
  if (rows.length <= max) return { rows, truncated: false };
  return { rows: rows.slice(0, max), truncated: true };
}

export function collectUniqueIds(groups: readonly (readonly string[])[]): string[] {
  const ids = new Set<string>();
  for (const group of groups) {
    for (const id of group) ids.add(id);
  }
  return [...ids];
}
