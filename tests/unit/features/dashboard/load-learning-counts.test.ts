import { beforeEach, describe, expect, it, vi } from "vitest";

import { loadUntouchedCardCount } from "@/features/dashboard/server/load-learning-counts";

type Row = { flashcard_id: string | null };

/** A chainable query whose `.in`/`.not` calls return the query itself and the
 * query awaits to the fixture rows (mirrors the loader's usage: `.in().not()`). */
function makeRequest(rows: Row[]) {
  const request = {
    in: vi.fn(),
    not: vi.fn(),
    then: undefined as unknown,
  };
  request.in.mockReturnValue(request);
  request.not.mockReturnValue(request);
  request.then = (resolve: (value: { data: Row[]; error: null }) => void) =>
    resolve({ data: rows, error: null });
  return request;
}

function supabaseFor(tables: Record<string, Row[]>) {
  const requests = Object.fromEntries(
    Object.entries(tables).map(([table, rows]) => [table, makeRequest(rows)]),
  );
  return {
    from: vi.fn((table: string) => ({
      select: vi.fn(() => requests[table]),
    })),
    requests,
  };
}

const CARD_IDS = ["card-1", "card-2", "card-3", "card-4"];

describe("loadUntouchedCardCount", () => {
  beforeEach(() => vi.clearAllMocks());

  it("counts cards never seen in any mode", async () => {
    const supabase = supabaseFor({
      mode_answer_events: [{ flashcard_id: "card-1" }],
      quiz_questions: [{ flashcard_id: "card-2" }],
      card_review_events: [{ flashcard_id: "card-3" }],
    });
    await expect(loadUntouchedCardCount(supabase as never, CARD_IDS)).resolves.toBe(1); // card-4
  });

  it("dedupes a card seen in several modes", async () => {
    const supabase = supabaseFor({
      mode_answer_events: [{ flashcard_id: "card-1" }],
      quiz_questions: [{ flashcard_id: "card-1" }],
      card_review_events: [{ flashcard_id: "card-1" }],
    });
    await expect(loadUntouchedCardCount(supabase as never, CARD_IDS)).resolves.toBe(3);
  });

  it("returns 0 when every eligible card has been seen", async () => {
    const supabase = supabaseFor({
      mode_answer_events: [{ flashcard_id: "card-1" }, { flashcard_id: "card-2" }],
      quiz_questions: [{ flashcard_id: "card-3" }, { flashcard_id: "card-4" }],
      card_review_events: [],
    });
    await expect(loadUntouchedCardCount(supabase as never, CARD_IDS)).resolves.toBe(0);
  });

  it("returns 0 for an empty eligible list without querying", async () => {
    const supabase = supabaseFor({});
    await expect(loadUntouchedCardCount(supabase as never, [])).resolves.toBe(0);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("fails closed when any query fails", async () => {
    const supabase = supabaseFor({
      mode_answer_events: [],
      quiz_questions: [],
      card_review_events: [],
    });
    supabase.requests.mode_answer_events.then = (
      resolve: (value: { data: Row[] | null; error: { code: string } }) => void,
    ) => resolve({ data: null, error: { code: "PGRST001" } });
    await expect(loadUntouchedCardCount(supabase as never, CARD_IDS)).rejects.toThrow(
      "untouched-card query failed",
    );
  });

  it("chunks eligible ids into batches of 200", async () => {
    const ids = Array.from({ length: 450 }, (_, index) => `card-${index}`);
    const supabase = supabaseFor({
      mode_answer_events: [],
      quiz_questions: [],
      card_review_events: [],
    });
    await expect(loadUntouchedCardCount(supabase as never, ids)).resolves.toBe(450);
    // 3 tables x 3 chunks = 9 in() calls.
    expect(supabase.from).toHaveBeenCalledTimes(9);
  });
});
