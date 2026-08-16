export function columnIndexToLetters(index: number): string {
  if (!Number.isFinite(index) || index < 0) return "A";
  let result = "";
  let n = index + 1;
  while (n > 0) {
    const remainder = (n - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}

export function lettersToColumnIndex(letters: string): number {
  let index = 0;
  for (const char of letters.toUpperCase()) {
    if (char < "A" || char > "Z") return -1;
    index = index * 26 + (char.charCodeAt(0) - 64);
  }
  return index - 1;
}

export function escapeA1SheetName(title: string): string {
  return `'${title.replace(/'/g, "''")}'`;
}

// Scans the whole sheet (open-ended row range) so every column that holds any
// data is discovered, no matter how far down the first value sits.
export function buildHeaderScanRange(sheetTitle: string, columnCount: number): string {
  const escaped = escapeA1SheetName(sheetTitle);
  const endCol = columnIndexToLetters(columnCount - 1);
  return `${escaped}!A1:${endCol}`;
}

export function buildDataColumnRange(
  sheetTitle: string,
  columnIndex: number,
  rowCount: number,
): string {
  const escaped = escapeA1SheetName(sheetTitle);
  const col = columnIndexToLetters(columnIndex);
  return `${escaped}!${col}2:${col}${rowCount + 1}`;
}

export function buildA1Range(sheetTitle: string, rowCount: number, columnCount: number): string {
  const escaped = escapeA1SheetName(sheetTitle);
  const endCol = columnIndexToLetters(columnCount - 1);
  return `${escaped}!A1:${endCol}${rowCount}`;
}
