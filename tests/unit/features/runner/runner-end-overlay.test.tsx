import type { ComponentProps } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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
    onBack: vi.fn(),
    onReplay: vi.fn(),
    onRetry: null,
    ...overrides,
  };
  return { props, ...render(<RunnerEndOverlay {...props} />) };
}

describe("RunnerEndOverlay", () => {
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

  it("keeps the back action available", () => {
    const onBack = vi.fn();
    renderOverlay({ onBack, onReplay: null });

    fireEvent.click(screen.getByRole("button", { name: "Quay lại" }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
