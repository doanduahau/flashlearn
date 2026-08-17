import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));

import { recordModeAnswers } from "@/features/learning-modes/server/record-mode-answers";

function supabaseFor(userId: string | null) {
  return {
    auth: {
      getClaims: vi.fn().mockResolvedValue({
        data: userId ? { claims: { sub: userId } } : null,
      }),
    },
  };
}

function adminFor(error: object | null = null) {
  return { rpc: vi.fn().mockResolvedValue({ error }) };
}

const ANSWERS = [
  { flashcardId: "11111111-1111-4111-8111-111111111111", isCorrect: true },
  { flashcardId: "22222222-2222-4222-8222-222222222222", isCorrect: false },
];

beforeEach(() => {
  mocks.createClient.mockReset();
  mocks.createAdminClient.mockReset();
});

describe("recordModeAnswers", () => {
  it("rejects invalid input", async () => {
    const result = await recordModeAnswers({ mode: "bogus", answers: [] });
    expect(result).toEqual({ ok: false, error: "Không thể lưu kết quả lúc này." });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated calls", async () => {
    mocks.createClient.mockResolvedValue(supabaseFor(null));
    const result = await recordModeAnswers({ mode: "match", answers: [] });
    expect(result).toEqual({ ok: false, error: "Phiên đăng nhập đã hết hạn." });
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("records per-card answers through the admin client", async () => {
    mocks.createClient.mockResolvedValue(supabaseFor("aaaaaaaa-7777-7777-7777-777777777777"));
    const admin = adminFor();
    mocks.createAdminClient.mockReturnValue(admin);

    const result = await recordModeAnswers({ mode: "match", answers: ANSWERS });

    expect(result).toEqual({ ok: true });
    expect(admin.rpc).toHaveBeenCalledWith("record_mode_answers", {
      p_user_id: "aaaaaaaa-7777-7777-7777-777777777777",
      p_mode: "match",
      p_answers: ANSWERS.map((answer) => ({
        flashcard_id: answer.flashcardId,
        is_correct: answer.isCorrect,
      })),
    });
  });

  it("rejects more than 200 answers", async () => {
    const many = Array.from({ length: 201 }, (_, index) => ({
      flashcardId: "11111111-1111-4111-8111-111111111111",
      isCorrect: true,
    }));
    const result = await recordModeAnswers({ mode: "typing", answers: many });
    expect(result).toEqual({ ok: false, error: "Không thể lưu kết quả lúc này." });
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("returns a generic error when the RPC fails", async () => {
    mocks.createClient.mockResolvedValue(supabaseFor("aaaaaaaa-7777-7777-7777-777777777777"));
    const admin = adminFor({ message: "boom" });
    mocks.createAdminClient.mockReturnValue(admin);

    const result = await recordModeAnswers({ mode: "match", answers: ANSWERS });
    expect(result).toEqual({ ok: false, error: "Không thể lưu kết quả lúc này." });
  });
});
