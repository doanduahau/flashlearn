import type { ComponentProps } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({ push: vi.fn(), back: vi.fn(), refresh: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

import { RunnerEndOverlay } from "@/features/runner/components/runner-end-overlay";

function renderOverlay(overrides: Partial<ComponentProps<typeof RunnerEndOverlay>> = {}) {
  const props: ComponentProps<typeof RunnerEndOverlay> = {
    status: "completed",
    elapsedMs: 61_000,
    level: 1,
    mascotState: "congrats",
    difficultyLabel: "Vừa",
    questionCount: 12,
    completedCount: 12,
    best: { bestMs: 60_000, isNewBest: true },
    persistenceError: null,
    replayPending: false,
    fallbackHref: "/study/mode",
    onReplay: vi.fn(),
    onRetry: null,
    ...overrides,
  };
  return { props, ...render(<RunnerEndOverlay {...props} />) };
}

describe("RunnerEndOverlay", () => {
  beforeEach(() => {
    router.push.mockReset();
    router.back.mockReset();
    router.refresh.mockReset();
  });

  it("shows a completed new personal best and replay controls", () => {
    renderOverlay();

    expect(screen.getByText("Hoàn thành!")).toBeInTheDocument();
    expect(screen.getByText(/Thời gian 01:01/)).toBeInTheDocument();
    expect(screen.getByText(/Kỷ lục mới! 01:00/)).toBeInTheDocument();
    expect(screen.getByText("12 câu · Vừa")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Chơi lại" })).toBeInTheDocument();
  });

  it("shows the current best when the completed result is not new", () => {
    renderOverlay({ best: { bestMs: 58_000, isNewBest: false } });

    expect(screen.getByText(/Kỷ lục: 00:58/)).toBeInTheDocument();
  });

  it("does not show a best or replay button after game over", () => {
    renderOverlay({
      status: "game-over",
      elapsedMs: 0,
      mascotState: "sad",
      completedCount: 3,
      best: null,
      onReplay: null,
    });

    expect(screen.getByText("Hết mạng!")).toBeInTheDocument();
    expect(screen.getByText("Đã hoàn thành 3/12 câu · 12 câu · Vừa")).toBeInTheDocument();
    expect(screen.queryByText(/Kỷ lục/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Chơi lại" })).toBeNull();
  });

  it("goes back to the previous path when history is available", () => {
    Object.defineProperty(window.history, "length", { configurable: true, value: 3 });
    renderOverlay({ onReplay: null });

    fireEvent.click(screen.getByRole("button", { name: "Thoát" }));
    expect(router.back).toHaveBeenCalledTimes(1);
    expect(router.push).not.toHaveBeenCalled();
  });

  it("falls back to the setup path when there is no history", () => {
    Object.defineProperty(window.history, "length", { configurable: true, value: 1 });
    renderOverlay({ onReplay: null });

    fireEvent.click(screen.getByRole("button", { name: "Thoát" }));
    expect(router.push).toHaveBeenCalledWith("/study/mode");
    expect(router.back).not.toHaveBeenCalled();
  });
});
