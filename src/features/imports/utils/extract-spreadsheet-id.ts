const SHEETS_URL_RE = /^https:\/\/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9-_]{30,})\//;

export function extractSpreadsheetId(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed.startsWith("https://docs.google.com/spreadsheets/d/")) {
    return null;
  }
  const match = trimmed.match(SHEETS_URL_RE);
  if (!match?.[1]) return null;
  return match[1];
}

export function isValidSheetsUrl(url: string): boolean {
  return extractSpreadsheetId(url) !== null;
}
