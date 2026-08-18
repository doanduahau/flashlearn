import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  fetchStudyCards: vi.fn(),
  loadAppearanceCounts: vi.fn(),
  loadWrongAnswerCardIds: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/features/study/server/load-study-cards", () => ({
  fetchStudyCards: mocks.fetchStudyCards,
}));
vi.mock("@/features/practice-coverage/server/actions", () => ({
  loadAppearanceCounts: mocks.loadAppearanceCounts,
  loadWrongAnswerCardIds: mocks.loadWrongAnswerCardIds,
  completeLearningCoverageSession: vi.fn(),
}));

import { getTypingAvailability, startTypingSession } from "@/features/typing/server/actions";

function cards(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `card-${index}`,
    front: `Câu ${index + 1}?`,
    back: `Trả lời ${index + 1}`,
  }));
}

function supabaseFor(userId: string | null) {
  return {
    auth: {
      getClaims: vi.fn().mockResolvedValue({
        data: userId ? { claims: { sub: userId } } : null,
      }),
    },
  };
}

beforeEach(() => {
  mocks.createClient.mockReset();
  mocks.createAdminClient.mockReset();
  mocks.fetchStudyCards.mockReset();
  mocks.loadAppearanceCounts.mockReset();
  mocks.loadWrongAnswerCardIds.mockReset();
});

describe("getTypingAvailability", () => {
  it("requires authentication", async () => {
    mocks.createClient.mockResolvedValue(supabaseFor(null));
    const result = await getTypingAvailability({ all: true });
    expect(result.ok).toBe(false);
  });

  it("reports eligible count and available counts", async () => {
    mocks.createClient.mockResolvedValue(supabaseFor("user-1"));
    mocks.fetchStudyCards.mockResolvedValue({ cards: cards(25), truncated: false });

    const result = await getTypingAvailability({ all: true });
    expect(result).toEqual({
      ok: true,
      availability: { eligibleCount: 25, availableCounts: [10, 20, 25] },
    });
  });
});

describe("startTypingSession", () => {
  it("requires authentication", async () => {
    mocks.createClient.mockResolvedValue(supabaseFor(null));
    const result = await startTypingSession({ all: true, questionCount: 10 });
    expect(result.ok).toBe(false);
  });

  it("rejects a count outside the available range", async () => {
    mocks.createClient.mockResolvedValue(supabaseFor("user-1"));
    mocks.fetchStudyCards.mockResolvedValue({ cards: cards(5), truncated: false });

    const result = await startTypingSession({ all: true, questionCount: 10 });
    expect(result.ok).toBe(false);
  });

  it("creates a typing coverage session with prioritized cards", async () => {
    mocks.createClient.mockResolvedValue(supabaseFor("user-1"));
    mocks.fetchStudyCards.mockResolvedValue({ cards: cards(15), truncated: false });
    mocks.loadAppearanceCounts.mockResolvedValue(new Map());
    mocks.loadWrongAnswerCardIds.mockResolvedValue(new Set(["card-0", "card-1"]));
    mocks.createAdminClient.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({ data: "coverage-1", error: null }),
    });

    const result = await startTypingSession({ all: true, questionCount: 10 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.session.coverageSessionId).toBe("coverage-1");
      expect(result.session.selectedCount).toBe(10);
      // Wrong answers are prioritized (both are present among the selection).
      const selectedIds = result.session.cards.map((card) => card.id);
      expect(selectedIds).toContain("card-0");
      expect(selectedIds).toContain("card-1");
    }
    expect(mocks.loadAppearanceCounts).toHaveBeenCalledWith(
      ["quiz", "match", "typing"],
      expect.any(Array),
    );
    expect(mocks.createAdminClient().rpc).toHaveBeenCalledWith(
      "create_learning_coverage_session",
      expect.objectContaining({ p_mode: "typing", p_user_id: "user-1" }),
    );
  });
});
