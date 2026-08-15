import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  collectStudyCardIds: vi.fn(),
  loadUncoveredIds: vi.fn(),
  loadWrongAnswerCardIds: vi.fn(),
  reconcileCardSchedule: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/features/study/server/load-study-cards", () => ({
  collectStudyCardIds: mocks.collectStudyCardIds,
}));
vi.mock("@/features/spaced-repetition/server/reconcile-card-schedule", () => ({
  reconcileCardSchedule: mocks.reconcileCardSchedule,
}));
vi.mock("@/features/practice-coverage/server/actions", () => ({
  loadUncoveredIds: mocks.loadUncoveredIds,
  loadWrongAnswerCardIds: mocks.loadWrongAnswerCardIds,
}));

import { startQuiz } from "@/features/quiz/server/actions";

function uuid(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
}

const POOL = [
  uuid(1),
  uuid(2),
  uuid(3),
  uuid(4),
  uuid(5),
  uuid(6),
  uuid(7),
  uuid(8),
  uuid(9),
  uuid(10),
  uuid(11),
  uuid(12),
];

describe("startQuiz prioritized selection", () => {
  beforeEach(() => {
    mocks.createClient.mockReset();
    mocks.createAdminClient.mockReset();
    mocks.collectStudyCardIds.mockReset();
    mocks.loadUncoveredIds.mockReset();
    mocks.loadWrongAnswerCardIds.mockReset();
  });

  function setup({ wrong, uncovered }: { wrong: string[]; uncovered: string[] }) {
    mocks.createClient.mockResolvedValue({
      auth: {
        getClaims: vi.fn().mockResolvedValue({ data: { claims: { sub: "user-a" } } }),
      },
    });
    mocks.collectStudyCardIds.mockResolvedValue(POOL);
    mocks.loadWrongAnswerCardIds.mockResolvedValue(new Set(wrong));
    mocks.loadUncoveredIds.mockResolvedValue(uncovered);
    const admin = { rpc: vi.fn().mockResolvedValue({ data: "session-1", error: null }) };
    mocks.createAdminClient.mockReturnValue(admin);
    return admin;
  }

  it("calls the prioritized RPC with wrong-first, then unseen, then random ids", async () => {
    const admin = setup({
      wrong: [POOL[2], POOL[5]],
      uncovered: [POOL[3], POOL[6], POOL[9]],
    });

    const result = await startQuiz({
      all: true,
      setIds: [],
      collectionIds: [],
      questionCount: 10,
    });

    expect(result).toEqual({ ok: true, sessionId: "session-1" });
    const [, args] = admin.rpc.mock.calls[0];
    expect(args.p_user_id).toBe("user-a");
    expect(args.p_question_count).toBe(10);
    expect(args.p_scope_card_ids).toEqual(POOL);
    // Wrong cards first regardless of shuffle order.
    expect(args.p_card_ids.slice(0, 2).sort()).toEqual([POOL[2], POOL[5]].sort());
    // Unseen cards next, excluding ones already picked as wrong.
    const wrongAndUnseen = [POOL[2], POOL[5], POOL[3], POOL[6], POOL[9]];
    expect(args.p_card_ids.slice(0, 5).sort()).toEqual(wrongAndUnseen.sort());
    expect(new Set(args.p_card_ids).size).toBe(10);
    expect(args.p_card_ids.every((id: string) => POOL.includes(id))).toBe(true);
  });

  it("mixes 3 wrong + 7 unseen into a 10-question selection", async () => {
    const wrong = POOL.slice(0, 3);
    const uncovered = POOL.slice(3, 10);
    const admin = setup({ wrong, uncovered });

    const result = await startQuiz({
      all: false,
      setIds: [uuid(100)],
      collectionIds: [],
      questionCount: 10,
    });

    expect(result).toEqual({ ok: true, sessionId: "session-1" });
    const [, args] = admin.rpc.mock.calls[0];
    expect(args.p_card_ids.slice(0, 3).sort()).toEqual(wrong.sort());
    expect(args.p_card_ids.slice(3, 10).sort()).toEqual(uncovered.sort());
  });

  it("returns a clear error when the pool is smaller than the requested count", async () => {
    setup({ wrong: [], uncovered: [] });
    mocks.collectStudyCardIds.mockResolvedValue(POOL.slice(0, 5));

    const result = await startQuiz({
      all: true,
      setIds: [],
      collectionIds: [],
      questionCount: 10,
    });

    expect(result).toEqual({ ok: false, error: "Không đủ thẻ để tạo bài kiểm tra." });
  });

  it("rejects without an authenticated subject and never calls the RPC", async () => {
    mocks.createClient.mockResolvedValue({
      auth: {
        getClaims: vi.fn().mockResolvedValue({ data: { claims: {} } }),
      },
    });

    const result = await startQuiz({
      all: true,
      setIds: [],
      collectionIds: [],
      questionCount: 10,
    });

    expect(result).toEqual({ ok: false, error: "Phiên đăng nhập đã hết hạn." });
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("fails closed with a generic message when the RPC errors", async () => {
    const admin = setup({ wrong: [], uncovered: [] });
    admin.rpc.mockResolvedValue({ data: null, error: new Error("boom") });

    const result = await startQuiz({
      all: true,
      setIds: [],
      collectionIds: [],
      questionCount: 10,
    });

    expect(result).toEqual({ ok: false, error: "Không thể xử lý bài kiểm tra. Vui lòng thử lại." });
  });
});
