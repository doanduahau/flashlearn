import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  reconcileCardSchedule: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/features/spaced-repetition/server/reconcile-card-schedule", () => ({
  reconcileCardSchedule: mocks.reconcileCardSchedule,
}));
vi.mock("@/features/practice-coverage/server/actions", () => ({
  completeLearningCoverageSession: vi.fn(),
}));

import { getQuizEligibility } from "@/features/quiz/server/actions";

function uuid(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
}

describe("getQuizEligibility via get_quiz_scope_sets", () => {
  beforeEach(() => {
    mocks.createClient.mockReset();
  });

  it("maps the scope RPC into total / uncovered / wrong counts", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          total: 25,
          appearance_counts: {
            [uuid(1)]: 0,
            [uuid(2)]: 0,
            [uuid(3)]: 0,
            [uuid(6)]: 2,
            [uuid(7)]: 1,
          },
          wrong_ids: [uuid(4), uuid(5)],
        },
      ],
      error: null,
    });
    mocks.createClient.mockResolvedValue({
      auth: {
        getClaims: vi.fn().mockResolvedValue({ data: { claims: { sub: "user-a" } } }),
      },
      rpc,
    });

    const result = await getQuizEligibility({ all: true, setIds: [], collectionIds: [] });

    expect(result).toEqual({ ok: true, total: 25, uncovered: 3, wrong: 2 });
    expect(rpc).toHaveBeenCalledWith("get_quiz_scope_sets", {
      p_set_ids: [],
      p_collection_ids: [],
      p_all: true,
    });
  });

  it("handles an empty scope array result as zeros", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    mocks.createClient.mockResolvedValue({
      auth: {
        getClaims: vi.fn().mockResolvedValue({ data: { claims: { sub: "user-a" } } }),
      },
      rpc,
    });

    const result = await getQuizEligibility({ all: false, setIds: [uuid(100)], collectionIds: [] });

    expect(result).toEqual({ ok: true, total: 0, uncovered: 0, wrong: 0 });
  });

  it("returns a generic error when the scope RPC fails", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: new Error("boom") });
    mocks.createClient.mockResolvedValue({
      auth: {
        getClaims: vi.fn().mockResolvedValue({ data: { claims: { sub: "user-a" } } }),
      },
      rpc,
    });

    const result = await getQuizEligibility({ all: true, setIds: [], collectionIds: [] });

    expect(result).toEqual({ ok: false, error: "Không thể xử lý bài kiểm tra. Vui lòng thử lại." });
  });

  it("rejects when not signed in", async () => {
    mocks.createClient.mockResolvedValue({
      auth: {
        getClaims: vi.fn().mockResolvedValue({ data: null }),
      },
      rpc: vi.fn(),
    });

    const result = await getQuizEligibility({ all: true, setIds: [], collectionIds: [] });

    expect(result).toEqual({ ok: false, error: "Phiên đăng nhập đã hết hạn." });
  });
});
