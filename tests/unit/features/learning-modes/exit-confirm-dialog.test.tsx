import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ExitConfirmDialog } from "@/features/learning-modes/components/exit-confirm-dialog";

describe("ExitConfirmDialog", () => {
  it("renders the confirmation copy and actions", () => {
    render(<ExitConfirmDialog onCancel={() => undefined} onConfirm={() => undefined} />);

    expect(screen.getByRole("dialog", { name: "Thoát phiên?" })).toBeInTheDocument();
    expect(screen.getByText("Tiến trình hiện tại sẽ bị mất.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hủy" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Thoát" })).toBeInTheDocument();
  });

  it("stays in the session when Hủy is pressed", () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(<ExitConfirmDialog onCancel={onCancel} onConfirm={onConfirm} />);

    fireEvent.click(screen.getByRole("button", { name: "Hủy" }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("navigates when Thoát is pressed", () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(<ExitConfirmDialog onCancel={onCancel} onConfirm={onConfirm} />);

    fireEvent.click(screen.getByRole("button", { name: "Thoát" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });
});
