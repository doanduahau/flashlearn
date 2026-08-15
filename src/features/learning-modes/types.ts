/**
 * Produces a no-duplicate selection with the Study-mode policy: latest-wrong
 * cards first, then uncovered cards, then the remaining pool in caller order.
 * Callers may pre-shuffle `ids` to make the final fallback random.
 */
export function selectCardsByPriority(
  ids: readonly string[],
  wrongIds: ReadonlySet<string>,
  uncoveredIds: ReadonlySet<string>,
  count: number,
): string[] {
  if (count <= 0) return [];
  const selected: string[] = [];
  const seen = new Set<string>();
  const add = (matches: (id: string) => boolean) => {
    for (const id of ids) {
      if (selected.length === count) return;
      if (!seen.has(id) && matches(id)) {
        seen.add(id);
        selected.push(id);
      }
    }
  };
  add((id) => wrongIds.has(id));
  add((id) => uncoveredIds.has(id));
  add(() => true);
  return selected;
}
