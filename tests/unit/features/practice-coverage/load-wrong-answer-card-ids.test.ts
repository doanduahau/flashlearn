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

/** Returns a supabase mock whose from(table) chains page through the matching table's pages. */
function supabaseFor(pagesByTable: Record<string, AnswerRow[][]>) {
  const requests: Record<string, ReturnType<typeof makeRequest>> = {};
  for (const table of Object.keys(pagesByTable)) {
    requests[table] = makeRequest(pagesByTable[table]);
  }
  return {
    from: vi.fn((table: string) => ({
      select: vi.fn(() => requests[table]),
    })),
    requests,
  };
}

function makeRequest(pages: AnswerRow[][]) {
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
  return request;
}

describe("loadWrongAnswerCardIds — merged quiz + mode_answer_events", () => {
  beforeEach(() => mocks.createClient.mockReset());

  it("uses only each card's latest answer across quiz and mode events", async () => {
    const supabase = supabaseFor({
      quiz_questions: [
        [
          {
            id: "quiz-correct-newer",
            flashcard_id: "card-wrong-then-correct",
            is_correct: true,
            answered_at: "2026-08-14T08:01:00.000Z",
          },
          {
            id: "quiz-wrong-older",
            flashcard_id: "card-wrong-then-correct",
            is_correct: false,
            answered_at: "2026-08-14T08:00:00.000Z",
          },
          {
            id: "quiz-latest-wrong",
            flashcard_id: "card-quiz-latest-wrong",
            is_correct: false,
            answered_at: "2026-08-14T08:00:00.000Z",
          },
        ],
      ],
      mode_answer_events: [
        [
          {
            id: "mode-wrong-newer",
            flashcard_id: "card-quiz-latest-wrong",
            is_correct: false,
            answered_at: "2026-08-14T08:02:00.000Z",
          },
          {
            id: "mode-correct-newest",
            flashcard_id: "card-mode-correct",
            is_correct: true,
            answered_at: "2026-08-14T08:03:00.000Z",
          },
          {
            id: "mode-wrong-oldest",
            flashcard_id: "card-mode-correct",
            is_correct: false,
            answered_at: "2026-08-14T08:00:00.000Z",
          },
        ],
      ],
    });
    mocks.createClient.mockResolvedValue(supabase);

    await expect(
      loadWrongAnswerCardIds([
        "card-wrong-then-correct",
        "card-quiz-latest-wrong",
        "card-mode-correct",
        "never-answered",
      ]),
    ).resolves.toEqual(new Set(["card-quiz-latest-wrong"]));
  });

  it("lets a typing wrong answer count as the latest answer for a card", async () => {
    const supabase = supabaseFor({
      quiz_questions: [
        [
          {
            id: "quiz-correct",
            flashcard_id: "card",
            is_correct: true,
            answered_at: "2026-08-14T08:00:00.000Z",
          },
        ],
      ],
      mode_answer_events: [
        [
          {
            id: "typing-wrong",
            flashcard_id: "card",
            is_correct: false,
            answered_at: "2026-08-14T09:00:00.000Z",
          },
        ],
      ],
    });
    mocks.createClient.mockResolvedValue(supabase);

    await expect(loadWrongAnswerCardIds(["card"])).resolves.toEqual(new Set(["card"]));
  });

  it("paginates completed quiz answers so an older latest answer is not truncated", async () => {
    const recentHistory = Array.from({ length: 1000 }, (_, index) => ({
      id: `recent-${String(index).padStart(4, "0")}`,
      flashcard_id: "recent-card",
      is_correct: true,
      answered_at: "2026-08-14T08:01:00.000Z",
    }));
    const supabase = supabaseFor({
      quiz_questions: [
        recentHistory,
        [
          {
            id: "older-latest-wrong",
            flashcard_id: "older-latest-wrong",
            is_correct: false,
            answered_at: "2026-08-13T08:01:00.000Z",
          },
        ],
      ],
      mode_answer_events: [[]],
    });
    mocks.createClient.mockResolvedValue(supabase);

    await expect(loadWrongAnswerCardIds(["recent-card", "older-latest-wrong"])).resolves.toEqual(
      new Set(["older-latest-wrong"]),
    );
    expect(supabase.requests.quiz_questions.range).toHaveBeenNthCalledWith(1, 0, 999);
    expect(supabase.requests.quiz_questions.range).toHaveBeenNthCalledWith(2, 1000, 1999);
  });

  it("fails closed when either query fails", async () => {
    const supabase = supabaseFor({ quiz_questions: [[]], mode_answer_events: [[]] });
    supabase.requests.mode_answer_events.range.mockResolvedValueOnce({
      data: null,
      error: { code: "PGRST001" },
    });
    mocks.createClient.mockResolvedValue(supabase);

    await expect(loadWrongAnswerCardIds(["card"])).rejects.toThrow("wrong-answer query failed");
  });
});
