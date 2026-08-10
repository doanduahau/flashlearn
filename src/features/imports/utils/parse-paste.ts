import type { DraftFlashcard, PasteAnalysisResult } from "../types/import-types";

const PAIR_RECOGNITION_THRESHOLD = 0.5;

function normalizeLine(text: string): string {
  return text.replace(/\r\n?/g, "\n").trim();
}

function removePrefix(text: string, prefix: string): string {
  const after = text.slice(prefix.length).trim();
  if (after.startsWith(":")) return after.slice(1).trim();
  return after;
}

function recognizeTsv(lines: string[]): DraftFlashcard[] | null {
  const cards: DraftFlashcard[] = [];
  for (const line of lines) {
    const trimmed = normalizeLine(line);
    if (!trimmed) continue;
    const parts = trimmed.split("\t");
    if (parts.length < 2) return null;
    const front = parts[0]!.trim();
    const back = parts[1]!.trim();
    if (!front || !back) return null;
    cards.push({ front, back });
  }
  return cards.length > 0 ? cards : null;
}

function recognizePaired(
  lines: string[],
  frontPrefix: string,
  backPrefix: string,
): DraftFlashcard[] | null {
  const cards: DraftFlashcard[] = [];
  let i = 0;
  while (i < lines.length) {
    const row = lines[i];
    if (!row) {
      i += 1;
      continue;
    }
    const frontLine = normalizeLine(row);
    const frontKey = frontPrefix.toLowerCase() + ":";
    if (!frontLine.toLowerCase().startsWith(frontKey)) {
      i += 1;
      continue;
    }
    const front = removePrefix(frontLine, frontPrefix);
    if (!front) {
      i += 1;
      continue;
    }
    let back = "";
    let j = i + 1;
    while (j < lines.length) {
      const nextRow = lines[j] ?? "";
      const nextLower = nextRow.toLowerCase();
      if (nextLower.startsWith(frontKey)) break;
      if (nextLower.startsWith(backPrefix.toLowerCase() + ":")) {
        back = removePrefix(normalizeLine(nextRow), backPrefix);
        j += 1;
        break;
      }
      j += 1;
    }
    if (back) {
      cards.push({ front, back });
    }
    i = j;
  }
  return cards.length > 0 ? cards : null;
}

function isLikelyProse(lines: string[]): boolean {
  const nonBlank = lines.filter((l) => normalizeLine(l));
  if (nonBlank.length <= 2) return false;

  let pairSignals = 0;
  for (const line of nonBlank) {
    const lower = line.toLowerCase();
    if (
      lower.startsWith("q:") ||
      lower.startsWith("question:") ||
      lower.startsWith("term:") ||
      lower.startsWith("a:") ||
      lower.startsWith("answer:") ||
      lower.startsWith("definition:")
    ) {
      pairSignals += 1;
    }
  }

  const tabs = nonBlank.filter((l) => l.includes("\t")).length;
  const tabRatio = tabs / nonBlank.length;
  if (tabRatio >= PAIR_RECOGNITION_THRESHOLD) return false;

  const pairRatio = pairSignals / nonBlank.length;
  if (pairRatio >= PAIR_RECOGNITION_THRESHOLD) return false;

  const avgLength = nonBlank.reduce((sum, l) => sum + l.length, 0) / nonBlank.length;
  const longLines = nonBlank.filter((l) => l.length > 80).length;
  const longRatio = longLines / nonBlank.length;

  if (pairRatio === 0 && avgLength > 40 && longRatio > 0.3) return true;
  return pairRatio < PAIR_RECOGNITION_THRESHOLD && avgLength > 60;
}

export function parsePaste(text: string): PasteAnalysisResult {
  const trimmed = text.trim();
  if (!trimmed) return { kind: "structured", cards: [] };

  const lines = trimmed.split("\n");
  const nonBlank = lines.filter((l) => normalizeLine(l).length > 0);

  if (nonBlank.length === 0) return { kind: "structured", cards: [] };

  const tsvResult = recognizeTsv(nonBlank);
  if (tsvResult) return { kind: "structured", cards: tsvResult };

  const qaResult = recognizePaired(nonBlank, "Q", "A");
  if (qaResult) return { kind: "structured", cards: qaResult };

  const questionResult = recognizePaired(nonBlank, "Question", "Answer");
  if (questionResult) return { kind: "structured", cards: questionResult };

  const termResult = recognizePaired(nonBlank, "Term", "Definition");
  if (termResult) return { kind: "structured", cards: termResult };

  if (isLikelyProse(nonBlank)) {
    return { kind: "semantic_required", text: trimmed };
  }

  return { kind: "semantic_required", text: trimmed };
}
