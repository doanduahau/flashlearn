import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  reviewBatch: vi.fn(),
  completeLearningCoverageSession: vi.fn(),
  startProcessingJob: vi.fn(),
  runProcessingJobPhase: vi.fn(),
  loadTypingJobResults: vi.fn(),
  reserveUsage: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/features/typing/server/gemini-answer-check", () => ({
  typingBatchCharacters: (items: Array<{ userAnswer: string; correctAnswer: string }>) =>
    items.reduce((total, item) => total + item.userAnswer.length + item.correctAnswer.length, 0),
  GeminiTypingBatchReviewer: class {
    review(items: unknown) {
      return mocks.reviewBatch(items);
    }
  },
}));
vi.mock("@/features/entitlements/server/entitlement-service", () => ({
  getEffectivePlan: vi.fn().mockResolvedValue("free"),
  reserveUsage: mocks.reserveUsage,
  finalizeUsage: vi.fn().mockResolvedValue(undefined),
  refundUsage: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/features/entitlements/server/processing-job-service", () => ({
  startProcessingJob: mocks.startProcessingJob,
  runProcessingJobPhase: mocks.runProcessingJobPhase,
  loadTypingJobResults: mocks.loadTypingJobResults,
  linkJobReservation: vi.fn().mockResolvedValue(undefined),
  storeTypingJobResults: vi.fn().mockResolvedValue(undefined),
  finishProcessingJob: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/features/entitlements/server/provider-call-budget", () => ({
  createProviderCallBudget: vi.fn(() => ({ beforeCall: vi.fn(), afterCall: vi.fn() })),
}));
vi.mock("@/features/practice-coverage/server/actions", () => ({
  completeLearningCoverageSession: mocks.completeLearningCoverageSession,
  loadAppearanceCounts: vi.fn(),
  loadWrongAnswerCardIds: vi.fn(),
}));

import { retryTypingSave, submitTypingAttempt } from "@/features/typing/server/actions";

const CARD_A = "11111111-1111-4111-8111-111111111111";
const CARD_B = "22222222-2222-4222-8222-222222222222";
const COVERAGE = "33333333-3333-4333-8333-333333333333";

function supabaseFor(
  userId: string | null,
  cards?: Array<{ id: string; front: string; back: string }>,
) {
  return {
    auth: {
      getClaims: vi.fn().mockResolvedValue({
        data: userId ? { claims: { sub: userId } } : null,
      }),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => {
        const builder = {
          in: vi.fn().mockResolvedValue({ data: cards ?? [], error: null }),
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
        return builder;
      }),
    })),
  };
}

function adminFor() {
  return { rpc: vi.fn().mockResolvedValue({ data: "ok", error: null }) };
}

beforeEach(() => {
  mocks.createClient.mockReset();
  mocks.createAdminClient.mockReset();
  mocks.reviewBatch.mockReset();
  mocks.startProcessingJob.mockReset();
  mocks.runProcessingJobPhase.mockReset();
  mocks.loadTypingJobResults.mockReset();
  mocks.reserveUsage.mockReset();
  mocks.completeLearningCoverageSession.mockReset();
  mocks.completeLearningCoverageSession.mockResolvedValue({ ok: true, didReset: false });
  mocks.startProcessingJob.mockResolvedValue({ id: COVERAGE, status: "queued", replayed: false });
  mocks.runProcessingJobPhase.mockImplementation(async (_job, operation) => operation());
  mocks.loadTypingJobResults.mockResolvedValue([]);
  mocks.reserveUsage.mockResolvedValue({
    reservation_id: "44444444-4444-4444-8444-444444444444",
    reservation_status: "reserved",
    enforcementMode: "observe",
    wouldBlock: false,
  });
  mocks.reviewBatch.mockImplementation(async (items: Array<{ id: string }>) =>
    items.map((item) => ({ id: item.id, correct: false, reason: "Khác nghĩa" })),
  );
});

describe("submitTypingAttempt — two-step grading", () => {
  it("requires authentication", async () => {
    mocks.createClient.mockResolvedValue(supabaseFor(null));
    const result = await submitTypingAttempt({
      coverageSessionId: COVERAGE,
      sourceAll: true,
      totalQuestions: 1,
      elapsedMs: 100,
      answers: [{ flashcardId: CARD_A, answer: "x" }],
    });
    expect(result.ok).toBe(false);
  });

  it("grades locally first and only asks the AI reviewer for wrong answers", async () => {
    mocks.createClient.mockResolvedValue(
      supabaseFor("user-1", [
        { id: CARD_A, front: "F1", back: "xin chào" },
        { id: CARD_B, front: "F2", back: "tạm biệt" },
      ]),
    );
    const admin = adminFor();
    mocks.createAdminClient.mockReturnValue(admin);
    mocks.reviewBatch.mockImplementation(async (items: Array<{ id: string }>) =>
      items.map((item) => ({ id: item.id, correct: true, reason: null })),
    );

    const result = await submitTypingAttempt({
      coverageSessionId: COVERAGE,
      sourceSetIds: [],
      sourceCollectionIds: [],
      sourceAll: true,
      totalQuestions: 2,
      elapsedMs: 250,
      answers: [
        { flashcardId: CARD_A, answer: "xin chào" },
        { flashcardId: CARD_B, answer: "bye bye" },
      ],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result.correctCount).toBe(2);
      expect(result.result.totalCount).toBe(2);
      expect(result.saveError).toBeNull();
    }
    expect(mocks.reviewBatch).toHaveBeenCalledTimes(1);
    expect(mocks.reviewBatch).toHaveBeenCalledWith([
      { id: CARD_B, userAnswer: "bye bye", correctAnswer: "tạm biệt" },
    ]);
  });

  it("records the typing attempt and per-card mode events via service role RPCs", async () => {
    mocks.createClient.mockResolvedValue(
      supabaseFor("user-1", [{ id: CARD_A, front: "F", back: "đúng" }]),
    );
    const admin = adminFor();
    mocks.createAdminClient.mockReturnValue(admin);

    const result = await submitTypingAttempt({
      coverageSessionId: COVERAGE,
      sourceSetIds: [],
      sourceCollectionIds: [],
      sourceAll: true,
      totalQuestions: 1,
      elapsedMs: 500,
      answers: [{ flashcardId: CARD_A, answer: "sai hẳn" }],
    });

    expect(result.ok).toBe(true);
    expect(admin.rpc).toHaveBeenCalledWith(
      "save_typing_attempt",
      expect.objectContaining({
        p_user_id: "user-1",
        p_total_questions: 1,
        p_correct_questions: 0,
        p_elapsed_ms: 500,
      }),
    );
    expect(admin.rpc).toHaveBeenCalledWith(
      "record_mode_answers",
      expect.objectContaining({
        p_user_id: "user-1",
        p_mode: "typing",
        p_answers: [{ flashcard_id: CARD_A, is_correct: false }],
      }),
    );
    expect(mocks.completeLearningCoverageSession).toHaveBeenCalledWith(COVERAGE);
  });

  it("uses a distinct stable reservation key when only remaining quota can be reviewed", async () => {
    mocks.createClient.mockResolvedValue(
      supabaseFor("user-1", [
        { id: CARD_A, front: "F1", back: "one" },
        { id: CARD_B, front: "F2", back: "two" },
      ]),
    );
    mocks.createAdminClient.mockReturnValue(adminFor());
    mocks.reserveUsage
      .mockResolvedValueOnce({
        reservation_id: null,
        reservation_status: "denied",
        enforcementMode: "block",
        wouldBlock: true,
        remaining: 1,
      })
      .mockResolvedValueOnce({
        reservation_id: "44444444-4444-4444-8444-444444444444",
        reservation_status: "reserved",
        enforcementMode: "block",
        wouldBlock: false,
      });

    const result = await submitTypingAttempt({
      coverageSessionId: COVERAGE,
      sourceAll: true,
      totalQuestions: 2,
      elapsedMs: 100,
      answers: [
        { flashcardId: CARD_A, answer: "wrong one" },
        { flashcardId: CARD_B, answer: "wrong two" },
      ],
    });

    expect(result.ok).toBe(true);
    expect(mocks.reserveUsage).toHaveBeenCalledTimes(2);
    expect(mocks.reserveUsage.mock.calls[0]?.[0].idempotencyKey).toBe(COVERAGE);
    expect(mocks.reserveUsage.mock.calls[1]?.[0].idempotencyKey).not.toBe(COVERAGE);
    expect(mocks.reviewBatch).toHaveBeenCalledWith([
      { id: CARD_A, userAnswer: "wrong one", correctAnswer: "one" },
    ]);
    if (result.ok) expect(result.result.gradingNotice).toContain("Một số câu");
  });

  it("shows a save error without blocking the result when the RPC fails", async () => {
    mocks.createClient.mockResolvedValue(
      supabaseFor("user-1", [{ id: CARD_A, front: "F", back: "đáp án" }]),
    );
    const admin = adminFor();
    admin.rpc.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    mocks.createAdminClient.mockReturnValue(admin);

    const result = await submitTypingAttempt({
      coverageSessionId: COVERAGE,
      sourceAll: true,
      totalQuestions: 1,
      elapsedMs: 100,
      answers: [{ flashcardId: CARD_A, answer: "đáp án" }],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result.correctCount).toBe(1);
      expect(result.saveError).toBe("Không thể lưu kết quả lúc này.");
    }
  });

  it("treats an empty answer as wrong", async () => {
    mocks.createClient.mockResolvedValue(
      supabaseFor("user-1", [{ id: CARD_A, front: "F", back: "đáp án" }]),
    );
    mocks.createAdminClient.mockReturnValue(adminFor());

    const result = await submitTypingAttempt({
      coverageSessionId: COVERAGE,
      sourceAll: true,
      totalQuestions: 1,
      elapsedMs: 100,
      answers: [{ flashcardId: CARD_A, answer: "   " }],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result.correctCount).toBe(0);
    }
  });
});

describe("retryTypingSave", () => {
  it("re-saves the graded result without re-grading", async () => {
    mocks.createClient.mockResolvedValue(supabaseFor("user-1"));
    const admin = adminFor();
    mocks.createAdminClient.mockReturnValue(admin);

    const result = await retryTypingSave({
      coverageSessionId: COVERAGE,
      sourceAll: true,
      totalQuestions: 1,
      correctCount: 1,
      elapsedMs: 100,
      answers: [{ flashcardId: CARD_A, isCorrect: true }],
    });

    expect(result.ok).toBe(true);
    expect(mocks.reviewBatch).not.toHaveBeenCalled();
    expect(admin.rpc).toHaveBeenCalledWith("save_typing_attempt", expect.anything());
    expect(admin.rpc).toHaveBeenCalledWith("record_mode_answers", expect.anything());
  });

  it("surfaces save errors", async () => {
    mocks.createClient.mockResolvedValue(supabaseFor("user-1"));
    const admin = adminFor();
    admin.rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    mocks.createAdminClient.mockReturnValue(admin);

    const result = await retryTypingSave({
      coverageSessionId: COVERAGE,
      sourceAll: true,
      totalQuestions: 1,
      correctCount: 0,
      elapsedMs: 100,
      answers: [{ flashcardId: CARD_A, isCorrect: false }],
    });

    expect(result.ok).toBe(false);
  });
});
