import { describe, expect, it } from "vitest";

import {
  compareDueCandidates,
  isDueForReview,
  selectDueCandidates,
  type DueCandidateInput,
} from "@/features/spaced-repetition/utils/due-candidates";
import { compareReviewSources } from "@/features/spaced-repetition/utils/compare-review-sources";

const T0 = "2026-08-09T12:00:00.000Z";

function candidate(
  flashcardId: string,
  due: string,
  lastReview: string | null = "2026-08-01T12:00:00.000Z",
  state = 2,
): DueCandidateInput {
  return { flashcardId, due, lastReview, state };
}

describe("isDueForReview", () => {
  it("due < evaluationTime => eligible", () => {
    expect(isDueForReview(candidate("a", "2026-08-09T11:59:59.000Z"), T0)).toBe(true);
  });

  it("due == evaluationTime => eligible", () => {
    expect(isDueForReview(candidate("a", T0), T0)).toBe(true);
  });

  it("due > evaluationTime => not eligible", () => {
    expect(isDueForReview(candidate("a", "2026-08-09T12:00:01.000Z"), T0)).toBe(false);
  });

  it("timezone does not alter eligibility (UTC points in time)", () => {
    // Same instant represented differently is still one instant.
    expect(isDueForReview(candidate("a", "2026-08-09T12:00:00+00:00"), T0)).toBe(true);
  });
});

describe("selectDueCandidates", () => {
  it("excludes candidates without a schedule row (not present)", () => {
    const result = selectDueCandidates([candidate("a", "2026-08-09T11:00:00.000Z")], T0);
    expect(result.map((c) => c.flashcardId)).toEqual(["a"]);
  });

  it("orders by due ascending (most overdue first)", () => {
    const candidates = [
      candidate("oldest", "2026-08-01T12:00:00.000Z"),
      candidate("newest", "2026-08-09T11:00:00.000Z"),
      candidate("middle", "2026-08-05T12:00:00.000Z"),
    ];
    const result = selectDueCandidates(candidates, T0);
    expect(result.map((c) => c.flashcardId)).toEqual(["oldest", "middle", "newest"]);
  });

  it("tie-breaks equal due by last_review ascending then flashcard_id ascending", () => {
    const candidates = [
      candidate("card-b", "2026-08-05T12:00:00.000Z", "2026-08-03T12:00:00.000Z"),
      candidate("card-a", "2026-08-05T12:00:00.000Z", "2026-08-02T12:00:00.000Z"),
      candidate("card-c", "2026-08-05T12:00:00.000Z", "2026-08-03T12:00:00.000Z"),
    ];
    // Same due; last_review asc puts card-a first; card-b vs card-c equal last_review → id asc.
    const result = selectDueCandidates(candidates, T0);
    expect(result.map((c) => c.flashcardId)).toEqual(["card-a", "card-b", "card-c"]);
  });

  it("handles null last_review deterministically before dated ones", () => {
    const candidates = [
      candidate("dated", "2026-08-05T12:00:00.000Z", "2026-08-03T12:00:00.000Z"),
      candidate("null", "2026-08-05T12:00:00.000Z", null),
    ];
    const result = selectDueCandidates(candidates, T0);
    expect(result.map((c) => c.flashcardId)).toEqual(["null", "dated"]);
  });

  it("applies a limit of 10 to top 10 only", () => {
    const base = Date.parse("2026-08-01T12:00:00.000Z");
    const candidates = Array.from({ length: 15 }, (_, i) =>
      candidate(`card-${String(i).padStart(2, "0")}`, new Date(base + i * 1000).toISOString()),
    );
    const result = selectDueCandidates(candidates, T0, 10);
    expect(result).toHaveLength(10);
  });

  it("does not alter ordering when no limit is supplied", () => {
    const candidates = [
      candidate("b", "2026-08-02T12:00:00.000Z"),
      candidate("a", "2026-08-01T12:00:00.000Z"),
    ];
    const result = selectDueCandidates(candidates, T0);
    expect(result.map((c) => c.flashcardId)).toEqual(["a", "b"]);
  });

  it("filters out future-due candidates before limiting", () => {
    const candidates = [
      candidate("future", "2026-08-10T12:00:00.000Z"),
      candidate("overdue", "2026-08-01T12:00:00.000Z"),
    ];
    const result = selectDueCandidates(candidates, T0);
    expect(result.map((c) => c.flashcardId)).toEqual(["overdue"]);
  });

  it("Mastery score does not influence FSRS ordering", () => {
    // selectDueCandidates has no score input; ordering is purely due/last_review/id.
    const candidates = [
      candidate("low-score-overdue", "2026-08-01T12:00:00.000Z"),
      candidate("high-score-overdue", "2026-08-01T12:00:01.000Z"),
    ];
    const result = selectDueCandidates(candidates, T0);
    expect(result.map((c) => c.flashcardId)).toEqual(["low-score-overdue", "high-score-overdue"]);
  });

  it("uses the same fixed evaluationTime for count and candidates", () => {
    const all = [
      candidate("past", "2026-08-01T12:00:00.000Z"),
      candidate("future", "2026-08-20T12:00:00.000Z"),
    ];
    const candidates = selectDueCandidates(all, T0);
    expect(candidates.map((c) => c.flashcardId)).toEqual(["past"]);
    // Total due = length of selectDueCandidates without limit = 1.
    expect(selectDueCandidates(all, T0).length).toBe(1);
  });
});

describe("compareDueCandidates", () => {
  it("is a stable total order", () => {
    const a = candidate("a", "2026-08-01T12:00:00.000Z");
    const b = candidate("b", "2026-08-01T12:00:00.000Z");
    const c = candidate("c", "2026-08-01T12:00:00.000Z");
    const arr = [c, a, b];
    const sorted = [...arr].sort(compareDueCandidates);
    expect(sorted.map((x) => x.flashcardId)).toEqual(["a", "b", "c"]);
  });
});

describe("compareReviewSources", () => {
  it("computes intersection, mastery-only and fsrs-only", () => {
    const result = compareReviewSources(["m1", "m2", "shared"], ["f1", "shared", "f2"]);
    expect(result).toEqual({
      masteryReviewCount: 3,
      fsrsDueCount: 3,
      inBoth: 1,
      masteryOnly: 2,
      fsrsOnly: 2,
    });
  });

  it("handles empty sets", () => {
    expect(compareReviewSources([], [])).toEqual({
      masteryReviewCount: 0,
      fsrsDueCount: 0,
      inBoth: 0,
      masteryOnly: 0,
      fsrsOnly: 0,
    });
  });
});
