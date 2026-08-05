export function sanitizeSearchQuery(value: string): string {
  return value
    .replace(/[\\%,()_]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
