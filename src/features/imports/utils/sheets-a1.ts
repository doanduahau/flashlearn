function columnIndexToLetters(index: number): string {
  let result = "";
  let n = index + 1;
  while (n > 0) {
    const remainder = (n - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}

export function escapeA1SheetName(title: string): string {
  return `'${title.replace(/'/g, "''")}'`;
}

export function buildA1Range(sheetTitle: string, rowCount: number, columnCount: number): string {
  const escaped = escapeA1SheetName(sheetTitle);
  const endCol = columnIndexToLetters(columnCount - 1);
  return `${escaped}!A1:${endCol}${rowCount}`;
}
