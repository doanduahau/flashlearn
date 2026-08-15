import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PauseOverlay } from "@/features/learning-modes/components/pause-overlay";

describe("PauseOverlay", () => {
  it("renders a modal pause dialog when paused", () => {
    render(<PauseOverlay onResume={() => undefined} />);

    const dialog = screen.getByRole("dialog", { name: "Đã tạm dừng" });
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(
      screen.getByText("Tiến trình học đã được tạm dừng khi bạn chuyển tab."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tiếp tục" })).toBeInTheDocument();
  });

  it("resumes the session when the continue button is pressed", () => {
    const onResume = vi.fn();
    render(<PauseOverlay onResume={onResume} />);

    fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));

    expect(onResume).toHaveBeenCalledTimes(1);
  });
});
