import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

import { loadWrongAnswerCardIds } from "@/features/practice-coverage/server/actions";

type AnswerRow = {
  id: string;
  flashcard_id: string;
  is_correct: boolean | null;
  answered_at: string;
};

function supabaseFor(pages: AnswerRow[][]) {
  const request = {
    in: vi.fn(),
    not: vi.fn(),
    order: vi.fn(),
    range: vi.fn(),
  };
  request.in.mockReturnValue(request);
  request.not.mockReturnValue(request);
  request.order.mockReturnValue(request);
  request.range.mockImplementation(() =>
    Promise.resolve({ data: pages.shift() ?? [], error: null }),
  );

  return {
    from: vi.fn(() => ({ select: vi.fn(() => request) })),
    request,
  };
}

describe("loadWrongAnswerCardIds", () => {
  beforeEach(() => mocks.createClient.mockReset());

  it("uses only each card's latest completed answer", async () => {
    const supabase = supabaseFor([
      [
        {
          id: "question-new-correct",
          flashcard_id: "answered-wrong-then-correct",
          is_correct: true,
          answered_at: "2026-08-14T08:01:00.000Z",
        },
        {
          id: "question-old-wrong",
          flashcard_id: "answered-wrong-then-correct",
          is_correct: false,
          answered_at: "2026-08-14T08:00:00.000Z",
        },
        {
          id: "question-latest-wrong",
          flashcard_id: "latest-wrong",
          is_correct: false,
          answered_at: "2026-08-14T08:00:00.000Z",
        },
      ],
    ]);
    mocks.createClient.mockResolvedValue(supabase);

    await expect(
      loadWrongAnswerCardIds(["answered-wrong-then-correct", "latest-wrong", "never-answered"]),
    ).resolves.toEqual(new Set(["latest-wrong"]));
    expect(supabase.request.order).toHaveBeenNthCalledWith(1, "answered_at", {
      ascending: false,
    });
    expect(supabase.request.order).toHaveBeenNthCalledWith(2, "id", { ascending: false });
  });

  it("paginates completed answers so an older latest answer is not truncated", async () => {
    const recentHistory = Array.from({ length: 1000 }, (_, index) => ({
      id: `recent-${String(index).padStart(4, "0")}`,
      flashcard_id: "recent-card",
      is_correct: true,
      answered_at: "2026-08-14T08:01:00.000Z",
    }));
    const supabase = supabaseFor([
      recentHistory,
      [
        {
          id: "older-latest-wrong",
          flashcard_id: "older-latest-wrong",
          is_correct: false,
          answered_at: "2026-08-13T08:01:00.000Z",
        },
      ],
    ]);
    mocks.createClient.mockResolvedValue(supabase);

    await expect(loadWrongAnswerCardIds(["recent-card", "older-latest-wrong"])).resolves.toEqual(
      new Set(["older-latest-wrong"]),
    );
    expect(supabase.request.range).toHaveBeenNthCalledWith(1, 0, 999);
    expect(supabase.request.range).toHaveBeenNthCalledWith(2, 1000, 1999);
  });

  it("fails closed when the completed-answer query fails", async () => {
    const supabase = supabaseFor([[]]);
    supabase.request.range.mockResolvedValueOnce({
      data: null,
      error: { code: "PGRST001" },
    });
    mocks.createClient.mockResolvedValue(supabase);

    await expect(loadWrongAnswerCardIds(["card"])).rejects.toThrow("wrong-answer query failed");
  });
});
