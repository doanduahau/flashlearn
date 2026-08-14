import { StrictMode, type ComponentProps } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RunnerSession } from "@/features/runner/components/runner-session";
import type { RunnerQuestion } from "@/features/runner/types/runner-types";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  completeCoverage: vi.fn(),
  submitBest: vi.fn(),
  startRunner: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, replace: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock("@/features/practice-coverage/server/actions", () => ({
  completeLearningCoverageSession: mocks.completeCoverage,
}));

vi.mock("@/features/runner/server/actions", () => ({
  startRunnerSession: mocks.startRunner,
  submitRunnerBestTime: mocks.submitBest,
}));

vi.mock("@/features/runner/components/runner-canvas", () => ({
  RunnerCanvas: ({
    dispatch,
  }: {
    dispatch: (event: { type: string; itemSeq?: number; deltaMs?: number }) => void;
  }) => (
    <div>
      <button
        type="button"
        onClick={() => {
          dispatch({ type: "TICK", deltaMs: 1_234 });
          dispatch({ type: "HIT_ACTIVE_ITEM", itemSeq: 0 });
          dispatch({ type: "HIT_ACTIVE_ITEM", itemSeq: 1 });
        }}
      >
        Hoàn thành mô phỏng
      </button>
      <button
        type="button"
        onClick={() => {
          dispatch({ type: "PASS_ACTIVE_ITEM", itemSeq: 0 });
          dispatch({ type: "HIT_ACTIVE_ITEM", itemSeq: 1 });
          dispatch({ type: "HIT_ACTIVE_ITEM", itemSeq: 2 });
        }}
      >
        Hết mạng mô phỏng
      </button>
    </div>
  ),
}));

const QUESTIONS: RunnerQuestion[] = [
  {
    flashcardId: "a",
    front: "Prompt 1",
    correctAnswer: "Answer 1",
    choices: ["Answer 1", "Wrong A", "Wrong B"],
  },
  {
    flashcardId: "b",
    front: "Prompt 2",
    correctAnswer: "Answer 2",
    choices: ["Answer 2", "Wrong C", "Wrong D"],
  },
];

function renderSession(
  strict = false,
  replaySource: ComponentProps<typeof RunnerSession>["replaySource"] = null,
) {
  const session = (
    <RunnerSession
      questions={QUESTIONS}
      difficulty="medium"
      mascotLevel={1}
      runnerSessionId="00000000-0000-4000-8000-000000000011"
      coverageSessionId="00000000-0000-4000-8000-000000000012"
      replaySource={replaySource}
    />
  );
  return render(strict ? <StrictMode>{session}</StrictMode> : session);
}

async function completeGame(): Promise<void> {
  fireEvent.click(screen.getByRole("button", { name: "Chạm để bắt đầu" }));
  fireEvent.click(screen.getByRole("button", { name: "Hoàn thành mô phỏng" }));
  await screen.findByText("Hoàn thành!");
}

describe("RunnerSession", () => {
  beforeEach(() => {
    mocks.push.mockReset();
    mocks.completeCoverage.mockReset().mockResolvedValue({ ok: true, didReset: false });
    mocks.submitBest.mockReset().mockResolvedValue({
      ok: true,
      bestMs: 1_234,
      questionCount: 2,
      isNewBest: true,
    });
    mocks.startRunner.mockReset();
  });

  afterEach(() => vi.restoreAllMocks());

  it("completes coverage before saving one precise best time", async () => {
    const order: string[] = [];
    mocks.completeCoverage.mockImplementation(async () => {
      order.push("coverage");
      return { ok: true, didReset: false };
    });
    mocks.submitBest.mockImplementation(async () => {
      order.push("best");
      return { ok: true, bestMs: 1_234, questionCount: 2, isNewBest: true };
    });
    renderSession();

    await completeGame();
    await waitFor(() => expect(mocks.submitBest).toHaveBeenCalledTimes(1));

    expect(order).toEqual(["coverage", "best"]);
    expect(mocks.completeCoverage).toHaveBeenCalledWith("00000000-0000-4000-8000-000000000012");
    expect(mocks.submitBest).toHaveBeenCalledWith("00000000-0000-4000-8000-000000000011", 1_234);
    expect(screen.getByText(/Kỷ lục mới! 00:01/)).toBeInTheDocument();
  });

  it("retries only the best-time submission after it fails", async () => {
    mocks.submitBest
      .mockResolvedValueOnce({ ok: false, error: "Không thể lưu kỷ lục lúc này." })
      .mockResolvedValueOnce({ ok: true, bestMs: 1_200, questionCount: 2, isNewBest: false });
    renderSession();

    await completeGame();
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));

    await waitFor(() => expect(mocks.submitBest).toHaveBeenCalledTimes(2));
    expect(mocks.completeCoverage).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Kỷ lục: 00:01/)).toBeInTheDocument();
  });

  it("recovers with a retry when best-time transport rejects", async () => {
    mocks.submitBest
      .mockRejectedValueOnce(new Error("transport failure"))
      .mockResolvedValueOnce({ ok: true, bestMs: 1_200, questionCount: 2, isNewBest: false });
    renderSession();

    await completeGame();
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));

    await waitFor(() => expect(mocks.submitBest).toHaveBeenCalledTimes(2));
    expect(mocks.completeCoverage).toHaveBeenCalledTimes(1);
  });

  it("retries coverage before saving a best when coverage completion fails", async () => {
    mocks.completeCoverage
      .mockResolvedValueOnce({ ok: false, error: "Không thể hoàn tất phiên học." })
      .mockResolvedValueOnce({ ok: true, didReset: false });
    renderSession();

    await completeGame();
    await screen.findByRole("alert");
    expect(mocks.submitBest).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));

    await waitFor(() => expect(mocks.submitBest).toHaveBeenCalledTimes(1));
    expect(mocks.completeCoverage).toHaveBeenCalledTimes(2);
  });

  it("recovers with a retry when coverage completion transport rejects", async () => {
    mocks.completeCoverage
      .mockRejectedValueOnce(new Error("transport failure"))
      .mockResolvedValueOnce({ ok: true, didReset: false });
    renderSession();

    await completeGame();
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));

    await waitFor(() => expect(mocks.submitBest).toHaveBeenCalledTimes(1));
    expect(mocks.completeCoverage).toHaveBeenCalledTimes(2);
  });

  it("does not complete coverage or save a best after game over", async () => {
    renderSession();
    fireEvent.click(screen.getByRole("button", { name: "Chạm để bắt đầu" }));
    fireEvent.click(screen.getByRole("button", { name: "Hết mạng mô phỏng" }));

    await screen.findByText("Hết mạng!");
    expect(mocks.completeCoverage).not.toHaveBeenCalled();
    expect(mocks.submitBest).not.toHaveBeenCalled();
    expect(screen.queryByText(/Kỷ lục/)).toBeNull();
  });

  it("submits only once when rendered in Strict Mode", async () => {
    renderSession(true);
    await completeGame();

    await waitFor(() => expect(mocks.submitBest).toHaveBeenCalledTimes(1));
    expect(mocks.completeCoverage).toHaveBeenCalledTimes(1);
  });

  it("replays through a fresh session URL with the original valid source", async () => {
    mocks.startRunner.mockResolvedValue({
      ok: true,
      session: {
        runnerSessionId: "00000000-0000-4000-8000-000000000099",
        selectedCount: 12,
        eligibleCount: 12,
      },
    });
    const source = {
      all: true,
      setIds: [],
      collectionIds: [],
      questionCount: 12 as const,
      difficulty: "medium" as const,
    };
    renderSession(false, source);

    await completeGame();
    await waitFor(() => expect(mocks.submitBest).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "Chơi lại" }));

    await waitFor(() => expect(mocks.startRunner).toHaveBeenCalledWith(source));
    expect(mocks.push).toHaveBeenCalledWith(
      "/runner/session?sessionId=00000000-0000-4000-8000-000000000099&count=12&difficulty=medium&all=1",
    );
  });

  it("keeps replay unavailable until the completed session is persisted", async () => {
    let resolveBest:
      | ((value: { ok: true; bestMs: number; questionCount: number; isNewBest: boolean }) => void)
      | undefined;
    mocks.submitBest.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveBest = resolve;
        }),
    );
    renderSession(false, {
      all: true,
      setIds: [],
      collectionIds: [],
      questionCount: 12,
      difficulty: "medium",
    });

    await completeGame();
    expect(screen.getByText("Đang lưu kỷ lục…")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Chơi lại" })).toBeNull();

    resolveBest?.({ ok: true, bestMs: 1_234, questionCount: 2, isNewBest: true });
    await screen.findByRole("button", { name: "Chơi lại" });
  });

  it("prevents duplicate replay session creation and reports transport errors", async () => {
    let resolveReplay:
      | ((value: {
          ok: true;
          session: { runnerSessionId: string; selectedCount: number; eligibleCount: number };
        }) => void)
      | undefined;
    mocks.startRunner.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveReplay = resolve;
        }),
    );
    const source = {
      all: true,
      setIds: [],
      collectionIds: [],
      questionCount: 12 as const,
      difficulty: "medium" as const,
    };
    const firstSession = renderSession(false, source);

    await completeGame();
    await waitFor(() => expect(mocks.submitBest).toHaveBeenCalledTimes(1));
    const replayButton = screen.getByRole("button", { name: "Chơi lại" });
    fireEvent.click(replayButton);
    fireEvent.click(replayButton);
    expect(mocks.startRunner).toHaveBeenCalledTimes(1);

    resolveReplay?.({
      ok: true,
      session: {
        runnerSessionId: "00000000-0000-4000-8000-000000000099",
        selectedCount: 12,
        eligibleCount: 12,
      },
    });
    await waitFor(() => expect(mocks.push).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "Chơi lại" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Chơi lại" }));
    expect(mocks.startRunner).toHaveBeenCalledTimes(1);

    firstSession.unmount();
    mocks.startRunner.mockRejectedValueOnce(new Error("transport failure"));
    // A fresh session exercises a rejected replay transport without reusing stale UI state.
    renderSession(false, source);
    await completeGame();
    await waitFor(() => expect(mocks.submitBest).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole("button", { name: "Chơi lại" }));
    await screen.findByRole("alert");
    expect(screen.getByRole("button", { name: "Chơi lại" })).toBeEnabled();
  });
});
