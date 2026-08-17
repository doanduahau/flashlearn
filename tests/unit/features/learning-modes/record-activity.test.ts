import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));

import { recordDailyActivity } from "@/features/learning-modes/server/record-activity";

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

beforeEach(() => {
  mocks.createClient.mockReset();
  mocks.createAdminClient.mockReset();
  mocks.revalidatePath.mockReset();
});

describe("recordDailyActivity", () => {
  it("rejects invalid input", async () => {
    const result = await recordDailyActivity({
      mode: "bogus",
      questionsAnswered: 0,
      correctAnswers: 0,
    });
    expect(result).toEqual({
      ok: false,
      error: "Không thể cập nhật hoạt động hôm nay. Vui lòng thử lại.",
    });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated calls", async () => {
    mocks.createClient.mockResolvedValue(supabaseFor(null));
    const result = await recordDailyActivity({
      mode: "study",
      questionsAnswered: 0,
      correctAnswers: 0,
    });
    expect(result).toEqual({ ok: false, error: "Phiên đăng nhập đã hết hạn." });
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("records a quiz-style mode with counts through the admin client", async () => {
    mocks.createClient.mockResolvedValue(supabaseFor("aaaaaaaa-7777-7777-7777-777777777777"));
    const admin = adminFor();
    mocks.createAdminClient.mockReturnValue(admin);

    const result = await recordDailyActivity({
      mode: "typing",
      questionsAnswered: 12,
      correctAnswers: 9,
    });

    expect(result).toEqual({ ok: true });
    expect(admin.rpc).toHaveBeenCalledWith("record_daily_activity", {
      p_user_id: "aaaaaaaa-7777-7777-7777-777777777777",
      p_mode: "typing",
      p_questions_answered: 12,
      p_correct_answers: 9,
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/profile");
  });

  it("records a non-quiz mode with zero counts", async () => {
    mocks.createClient.mockResolvedValue(supabaseFor("aaaaaaaa-7777-7777-7777-777777777777"));
    const admin = adminFor();
    mocks.createAdminClient.mockReturnValue(admin);

    const result = await recordDailyActivity({
      mode: "memory",
      questionsAnswered: 0,
      correctAnswers: 0,
    });

    expect(result).toEqual({ ok: true });
    expect(admin.rpc).toHaveBeenCalledWith("record_daily_activity", {
      p_user_id: "aaaaaaaa-7777-7777-7777-777777777777",
      p_mode: "memory",
      p_questions_answered: 0,
      p_correct_answers: 0,
    });
  });

  it("returns a generic error when the RPC fails", async () => {
    mocks.createClient.mockResolvedValue(supabaseFor("aaaaaaaa-7777-7777-7777-777777777777"));
    const admin = adminFor({ message: "boom" });
    mocks.createAdminClient.mockReturnValue(admin);

    const result = await recordDailyActivity({
      mode: "runner",
      questionsAnswered: 0,
      correctAnswers: 0,
    });

    expect(result).toEqual({
      ok: false,
      error: "Không thể cập nhật hoạt động hôm nay. Vui lòng thử lại.",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
