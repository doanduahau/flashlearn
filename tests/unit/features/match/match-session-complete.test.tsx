import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  startMatchCoverageSession,
  completeLearningCoverageSession,
  saveMatchAttempt,
  router,
  recordDailyActivity,
  recordModeAnswers,
} = vi.hoisted(() => ({
  startMatchCoverageSession: vi.fn(),
  completeLearningCoverageSession: vi.fn(),
  saveMatchAttempt: vi.fn(),
  recordDailyActivity: vi.fn(),
  recordModeAnswers: vi.fn(),
  router: { push: vi.fn(), back: vi.fn(), refresh: vi.fn() },
}));

vi.mock("@/features/match/server/actions", () => ({ startMatchCoverageSession, saveMatchAttempt }));
vi.mock("@/features/practice-coverage/server/actions", () => ({ completeLearningCoverageSession }));
vi.mock("@/features/learning-modes/server/record-activity", () => ({ recordDailyActivity }));
vi.mock("@/features/learning-modes/server/record-mode-answers", () => ({ recordModeAnswers }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

import { MatchSession } from "@/features/match/components/match-session";
import type { StartedMatchSession } from "@/features/match/types/match-types";

const session: StartedMatchSession = {
  coverageSessionId: "22222222-2222-2222-2222-222222222222",
  selectedCount: 12,
  eligibleCount: 12,
  batches: [
    {
      fronts: ["a", "b", "c", "d", "e", "f"].map((id) => ({
        id,
        front: `front-${id}`,
        back: `back-${id}`,
      })),
      backs: ["a", "b", "c", "d", "e", "f"].map((id) => ({
        id,
        front: `front-${id}`,
        back: `back-${id}`,
      })),
    },
    {
      fronts: ["g", "h", "i", "j", "k", "l"].map((id) => ({
        id,
        front: `front-${id}`,
        back: `back-${id}`,
      })),
      backs: ["g", "h", "i", "j", "k", "l"].map((id) => ({
        id,
        front: `front-${id}`,
        back: `back-${id}`,
      })),
    },
  ],
};

async function renderSession() {
  render(
    <MatchSession
      sessionHref="/match/session?all=1&count=12"
      questionCount={12}
      exitHref="/study/mode?all=1"
      mascotLevel={1}
    />,
  );
  await waitFor(() => expect(screen.getByRole("button", { name: "front-a" })).toBeInTheDocument());
}

async function matchBatch(ids: string[]) {
  for (const id of ids) {
    fireEvent.click(screen.getByRole("button", { name: `front-${id}` }));
    fireEvent.click(screen.getByRole("button", { name: `back-${id}` }));
  }
}

async function completeAllPairs() {
  await act(async () => {
    await matchBatch(["a", "b", "c", "d", "e", "f"]);
  });
  await waitFor(() => expect(screen.getByRole("button", { name: "front-g" })).toBeInTheDocument());
  await act(async () => {
    await matchBatch(["g", "h", "i", "j", "k", "l"]);
  });
}

describe("MatchSession completion persistence", () => {
  beforeEach(() => {
    startMatchCoverageSession.mockReset();
    completeLearningCoverageSession.mockReset();
    saveMatchAttempt.mockReset();
    recordDailyActivity.mockReset();
    recordModeAnswers.mockReset();
    router.push.mockReset();
    router.back.mockReset();
    startMatchCoverageSession.mockResolvedValue({ ok: true, session });
    completeLearningCoverageSession.mockResolvedValue({ ok: true });
    saveMatchAttempt.mockResolvedValue({ ok: true });
    recordDailyActivity.mockResolvedValue({ ok: true });
    recordModeAnswers.mockResolvedValue({ ok: true });
  });

  it("completes coverage first then saves the match attempt with stats", async () => {
    await renderSession();
    await act(async () => {
      await completeAllPairs();
    });

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Hoàn thành!" })).toBeInTheDocument(),
    );

    expect(completeLearningCoverageSession).toHaveBeenCalledTimes(1);
    expect(completeLearningCoverageSession).toHaveBeenCalledWith(session.coverageSessionId);
    expect(saveMatchAttempt).toHaveBeenCalledTimes(1);
    expect(saveMatchAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceAll: true,
        sourceSetIds: [],
        sourceCollectionIds: [],
        totalPairs: 12,
        correctPairs: 12,
        incorrectAttempts: 0,
        elapsedMs: expect.any(Number),
      }),
    );
    expect(recordModeAnswers).toHaveBeenCalledTimes(1);
    expect(recordModeAnswers).toHaveBeenCalledWith({
      mode: "match",
      answers: expect.arrayContaining([
        { flashcardId: "a", isCorrect: true },
        { flashcardId: "l", isCorrect: true },
      ]),
    });
    expect(recordDailyActivity).toHaveBeenCalledWith({
      mode: "match",
      questionsAnswered: 12,
      correctAnswers: 12,
    });
  });

  it("passes incorrect attempt count when pairs are matched wrongly", async () => {
    await renderSession();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "front-a" }));
      fireEvent.click(screen.getByRole("button", { name: "back-b" }));
      await completeAllPairs();
    });

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Hoàn thành!" })).toBeInTheDocument(),
    );
    expect(saveMatchAttempt).toHaveBeenCalledWith(
      expect.objectContaining({ correctPairs: 12, incorrectAttempts: 1 }),
    );
    // The wrong pair (front-a + back-b) is counted as an incorrect attempt,
    // but every card is later matched correctly, so the per-card event for a
    // card that ended correct wins (latest answer per card is correct).
    expect(recordModeAnswers).toHaveBeenCalledWith({
      mode: "match",
      answers: expect.arrayContaining([
        { flashcardId: "a", isCorrect: true },
        { flashcardId: "b", isCorrect: true },
      ]),
    });
  });

  it("does not save a match attempt when coverage completion fails", async () => {
    completeLearningCoverageSession.mockResolvedValue({ ok: false, error: "Không thể hoàn tất." });
    await renderSession();
    await act(async () => {
      await completeAllPairs();
    });

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Không thể hoàn tất."));
    expect(saveMatchAttempt).not.toHaveBeenCalled();
    expect(recordModeAnswers).not.toHaveBeenCalled();
    expect(recordDailyActivity).not.toHaveBeenCalled();
    expect(screen.queryByRole("heading", { name: "Hoàn thành!" })).not.toBeInTheDocument();
  });

  it("shows the completion screen with a retry when match save fails", async () => {
    saveMatchAttempt.mockResolvedValue({ ok: false, error: "Không thể lưu kết quả lúc này." });
    await renderSession();
    await act(async () => {
      await completeAllPairs();
    });

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Hoàn thành!" })).toBeInTheDocument(),
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Không thể lưu kết quả lúc này.");
    const retryButton = screen.getByRole("button", { name: "Thử lại lưu kết quả" });
    expect(retryButton).toBeInTheDocument();

    saveMatchAttempt.mockResolvedValue({ ok: true });
    fireEvent.click(retryButton);
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(saveMatchAttempt).toHaveBeenCalledTimes(2);
  });

  it("guards against double submission while completing", async () => {
    let resolveCoverage: (value: { ok: boolean; didReset?: boolean }) => void = () => undefined;
    completeLearningCoverageSession.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCoverage = resolve;
        }),
    );
    await renderSession();
    await act(async () => {
      await completeAllPairs();
    });
    expect(completeLearningCoverageSession).toHaveBeenCalledTimes(1);

    // Board is already in the completed phase and fires onComplete once, so no
    // second coverage call can be triggered by stale taps.
    await act(async () => {
      resolveCoverage({ ok: true });
    });
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Hoàn thành!" })).toBeInTheDocument(),
    );
    expect(completeLearningCoverageSession).toHaveBeenCalledTimes(1);
    expect(saveMatchAttempt).toHaveBeenCalledTimes(1);
  });
});
