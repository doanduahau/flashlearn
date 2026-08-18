/**
 * Produces a no-duplicate selection with the shared learning/quiz policy:
 * latest-wrong cards first, then the remaining cards sorted ascending by
 * appearance count within the card's mode group (quiz/match/typing or
 * memory/runner; fewer appearances are picked first). Ties keep the caller's
 * input order, so callers may pre-shuffle `ids` for a
 * deterministic-but-varied remainder.
 */
export function selectCardsByPriority(
  ids: readonly string[],
  wrongIds: ReadonlySet<string>,
  appearanceCounts: ReadonlyMap<string, number>,
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
  // Remaining cards: ascending by appearance count (default 0 = never appeared).
  const remaining = ids.filter((id) => !seen.has(id));
  remaining.sort((a, b) => {
    const countA = appearanceCounts.get(a) ?? 0;
    const countB = appearanceCounts.get(b) ?? 0;
    return countA - countB;
  });
  for (const id of remaining) {
    if (selected.length === count) break;
    seen.add(id);
    selected.push(id);
  }
  return selected;
}
