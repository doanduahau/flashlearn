import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  reconcileCardSchedule: vi.fn(),
  completeLearningCoverageSession: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/features/spaced-repetition/server/reconcile-card-schedule", () => ({
  reconcileCardSchedule: mocks.reconcileCardSchedule,
}));
vi.mock("@/features/practice-coverage/server/actions", () => ({
  completeLearningCoverageSession: mocks.completeLearningCoverageSession,
}));

import { submitQuizAnswer } from "@/features/quiz/server/actions";

const questionId = "11111111-1111-4000-8000-111111111111";
const flashcardId = "22222222-2222-4000-8000-222222222222";

function authenticatedSupabase() {
  return {
    auth: {
      getClaims: vi.fn().mockResolvedValue({ data: { claims: { sub: "user-a" } } }),
    },
    rpc: vi.fn().mockResolvedValue({
      data: [
        {
          session_id: "33333333-3333-3333-3333-333333333333",
          is_correct: true,
          completed: false,
          flashcard_id: flashcardId,
          review_event_id: "44444444-4444-4444-4444-444444444444",
        },
      ],
      error: null,
    }),
    from: vi.fn(),
  };
}

describe("submitQuizAnswer FSRS shadow boundary", () => {
  beforeEach(() => {
    mocks.createClient.mockReset();
    mocks.reconcileCardSchedule.mockReset();
    mocks.completeLearningCoverageSession.mockReset();
  });

  it("uses the verified claims subject for reconciliation and returns only quiz UX fields", async () => {
    const supabase = authenticatedSupabase();
    mocks.createClient.mockResolvedValue(supabase);

    await expect(submitQuizAnswer({ questionId, selectedChoiceIndex: 0 })).resolves.toEqual({
      ok: true,
      correct: true,
      completed: false,
    });
    expect(supabase.rpc).toHaveBeenCalledWith("submit_quiz_answer", {
      p_question_id: questionId,
      p_selected_choice_index: 0,
    });
    expect(mocks.reconcileCardSchedule).toHaveBeenCalledWith(supabase, "user-a", flashcardId);
  });

  it("keeps a committed quiz success when shadow reconciliation fails and logs no raw error text", async () => {
    const supabase = authenticatedSupabase();
    mocks.createClient.mockResolvedValue(supabase);
    mocks.reconcileCardSchedule.mockRejectedValue({
      code: "XX000",
      message: "internal secret detail",
    });
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(submitQuizAnswer({ questionId, selectedChoiceIndex: 0 })).resolves.toEqual({
      ok: true,
      correct: true,
      completed: false,
    });
    expect(error).toHaveBeenCalledWith(expect.stringContaining("category=database_XX000"));
    expect(error.mock.calls.flat().join(" ")).not.toContain("internal secret detail");
    error.mockRestore();
  });

  it("does not call the authoritative RPC or shadow writer without a verified claims subject", async () => {
    const supabase = authenticatedSupabase();
    supabase.auth.getClaims.mockResolvedValue({ data: { claims: {} } });
    mocks.createClient.mockResolvedValue(supabase);

    await expect(submitQuizAnswer({ questionId, selectedChoiceIndex: 0 })).resolves.toMatchObject({
      ok: false,
    });
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(mocks.reconcileCardSchedule).not.toHaveBeenCalled();
  });

  it.each(["smart_review", "new_cards"])(
    "does not read or complete quiz coverage for a completed %s session",
    async (origin) => {
      const supabase = authenticatedSupabase();
      supabase.rpc.mockResolvedValue({
        data: [
          {
            session_id: "33333333-3333-3333-3333-333333333333",
            is_correct: true,
            completed: true,
            flashcard_id: flashcardId,
            review_event_id: "44444444-4444-4444-4444-444444444444",
          },
        ],
        error: null,
      });
      const ledgerQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null }),
      };
      supabase.from
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi
              .fn()
              .mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: { origin } }) }),
          }),
        })
        .mockReturnValue(ledgerQuery);
      mocks.createClient.mockResolvedValue(supabase);

      await expect(submitQuizAnswer({ questionId, selectedChoiceIndex: 0 })).resolves.toMatchObject(
        {
          ok: true,
          completed: true,
        },
      );
      expect(supabase.from).toHaveBeenCalledTimes(1);
      expect(mocks.completeLearningCoverageSession).not.toHaveBeenCalled();
    },
  );
});
