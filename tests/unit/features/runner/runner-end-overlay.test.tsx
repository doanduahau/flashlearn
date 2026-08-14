import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RunnerEndOverlay } from "@/features/runner/components/runner-end-overlay";

describe("RunnerEndOverlay", () => {
  it("renders the game-over heading with a back button", () => {
    const onBack = vi.fn();
    render(
      <RunnerEndOverlay
        status="game-over"
        elapsedMs={0}
        level={1}
        mascotState="sad"
        onBack={onBack}
      />,
    );

    expect(screen.getByText("Hết mạng!")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Quay lại" }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("renders the completed heading with the elapsed time", () => {
    render(
      <RunnerEndOverlay
        status="completed"
        elapsedMs={61_000}
        level={1}
        mascotState="congrats"
        onBack={() => {}}
      />,
    );

    expect(screen.getByText("Hoàn thành!")).toBeInTheDocument();
    expect(screen.getByText(/Thời gian 01:01/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Quay lại" })).toBeInTheDocument();
  });

  it("renders the sad mascot for a completed game with many mistakes", () => {
    const { container } = render(
      <RunnerEndOverlay
        status="completed"
        elapsedMs={10_000}
        level={3}
        mascotState="sad"
        onBack={() => {}}
      />,
    );
    const image = container.querySelector("img");
    expect(image).toHaveAttribute("src", "/mascot/level-3/sad.png");
  });
});
