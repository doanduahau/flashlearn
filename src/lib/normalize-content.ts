/**
 * Canonical normalization for learning-mode ambiguity detection.
 *
 * This mirrors the existing Quiz distractor normalization
 * `lower(regexp_replace(btrim(value), '\s+', ' ', 'g'))` used by the PostgreSQL
 * session-creation functions, so every practice mode treats content exactly the
 * way Quiz already treats it for option distinctness. It is used only for
 * ambiguity detection, never for rendering user text.
 */
export function normalizeContentText(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}
