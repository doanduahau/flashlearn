import { describe, expect, it } from "vitest";

import type { StudySourceRow } from "@/features/study/types/study-types";
import {
  capRows,
  collectUniqueIds,
  collectUniqueRows,
  compareRows,
} from "@/features/study/utils/merge-cards";

function row(id: string, set_id: string, position: number): StudySourceRow {
  return {
    id,
    front: `front-${id}`,
    back: `back-${id}`,
    set_id,
    position,
    flashcard_sets: { name: set_id },
  };
}

describe("collectUniqueRows", () => {
  it("deduplicates rows by id across groups, keeping the first occurrence", () => {
    const groupA = [row("card-1", "set-a", 0), row("card-2", "set-a", 1)];
    const groupB = [row("card-2", "set-b", 0), row("card-3", "set-b", 1)];

    const result = collectUniqueRows([groupA, groupB]);

    expect(result).toHaveLength(3);
    expect(result.map((r) => r.id)).toEqual(["card-1", "card-2", "card-3"]);
    expect(result[1].set_id).toBe("set-a");
  });

  it("returns an empty array for no groups", () => {
    expect(collectUniqueRows([])).toEqual([]);
  });
});

describe("compareRows", () => {
  it("orders by set id, then position, then id", () => {
    const rows = [
      row("card-2", "set-a", 1),
      row("card-1", "set-b", 0),
      row("card-1", "set-a", 0),
      row("card-0", "set-a", 0),
    ].sort(compareRows);

    expect(rows.map((r) => `${r.set_id}:${r.position}:${r.id}`)).toEqual([
      "set-a:0:card-0",
      "set-a:0:card-1",
      "set-a:1:card-2",
      "set-b:0:card-1",
    ]);
  });
});

describe("capRows", () => {
  it("caps the list at the maximum and reports truncation", () => {
    const rows = [row("a", "set-a", 0), row("b", "set-a", 1), row("c", "set-a", 2)];
    const result = capRows(rows, 2);
    expect(result.truncated).toBe(true);
    expect(result.rows.map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("keeps the list unchanged when within the maximum", () => {
    const rows = [row("a", "set-a", 0), row("b", "set-a", 1)];
    const result = capRows(rows, 2);
    expect(result.truncated).toBe(false);
    expect(result.rows).toHaveLength(2);
  });
});

describe("collectUniqueIds", () => {
  it("unions id lists across groups without duplicates", () => {
    const result = collectUniqueIds([["a", "b"], ["b", "c"], []]);
    expect(result).toEqual(["a", "b", "c"]);
  });
});
