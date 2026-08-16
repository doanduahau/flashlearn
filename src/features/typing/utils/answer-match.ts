// Pure local answer matching for the typing quiz mode.
// Step 1 of grading: the system grades locally first; only answers marked
// wrong here are sent to the AI reviewer (Task N9 design).

// Marks that compose Vietnamese diacritics (after NFD normalization).
const COMBINING_MARKS = /[\u0300-\u036f]/g;
// Punctuation stripped from both ends of a token; numbers are preserved.
const EDGE_PUNCTUATION = /^[.,;:!?()\[\]{}'"“”‘’«»…\-–—/\\|]+|[.,;:!?()\[\]{}'"“”‘’«»…\-–—/\\|]+$/g;

/**
 * Normalizes an answer for comparison:
 * trim → collapse whitespace → lowercase → strip Vietnamese diacritics
 * (NFD + remove combining marks + đ/Đ → d) → strip punctuation from both
 * ends of each token. Digits are kept.
 */
export function normalizeAnswer(text: string): string {
  return text
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.replace(EDGE_PUNCTUATION, ""))
    .filter((token) => token.length > 0)
    .join(" ");
}

/**
 * Plain Levenshtein edit distance (no library).
 */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prev: number[] = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const curr: number[] = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1]! + 1, prev[j]! + 1, prev[j - 1]! + cost);
    }
    prev = curr;
  }
  return prev[b.length]!;
}

/**
 * Locally grades an answer against the expected one:
 * 1. normalized equality → correct;
 * 2. token intersection / max(token count) ≥ 0.8 → correct;
 * 3. Levenshtein similarity ≥ 0.85 (longest normalized length ≥ 4) → correct;
 * 4. otherwise wrong.
 * If either side normalizes to empty, the answer is wrong.
 */
export function isAnswerCorrect(userAnswer: string, correctAnswer: string): boolean {
  const user = normalizeAnswer(userAnswer);
  const correct = normalizeAnswer(correctAnswer);
  if (!user || !correct) return false;

  if (user === correct) return true;

  const userTokens = user.split(" ");
  const correctTokens = correct.split(" ");
  const correctSet = new Set(correctTokens);
  const matched = userTokens.filter((token) => correctSet.has(token)).length;
  const maxTokenCount = Math.max(userTokens.length, correctTokens.length);
  if (maxTokenCount > 0 && matched / maxTokenCount >= 0.8) return true;

  const maxLength = Math.max(user.length, correct.length);
  if (maxLength >= 4) {
    const distance = levenshtein(user, correct);
    if (1 - distance / maxLength >= 0.85) return true;
  }

  return false;
}
