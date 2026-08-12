/**
 * Canonical normalization for Match ambiguity detection.
 *
 * This mirrors the existing Quiz distractor normalization
 * `lower(regexp_replace(btrim(back), '\\s+', ' ', 'g'))` used by the
 * PostgreSQL session-creation functions, so Match treats content exactly the
 * way Quiz already treats it for option distinctness. It is used only for
 * ambiguity detection, never for rendering user text.
 */
export function normalizeMatchText(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function uniqueFrontKeys(cards: readonly { front: string }[]): Set<string> {
  return new Set(cards.map((card) => normalizeMatchText(card.front)));
}

export function uniqueBackKeys(cards: readonly { back: string }[]): Set<string> {
  return new Set(cards.map((card) => normalizeMatchText(card.back)));
}
