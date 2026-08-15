import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({ push: vi.fn(), back: vi.fn(), refresh: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

import { SessionExitButton } from "@/features/learning-modes/components/session-exit-button";

describe("SessionExitButton", () => {
  beforeEach(() => {
    router.push.mockReset();
    router.back.mockReset();
    router.refresh.mockReset();
  });

  it("opens the confirmation dialog when the back arrow is pressed", () => {
    render(<SessionExitButton fallbackHref="/study/mode" />);

    expect(screen.queryByRole("dialog", { name: "Thoát phiên?" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Thoát phiên học" }));

    expect(screen.getByRole("dialog", { name: "Thoát phiên?" })).toBeInTheDocument();
    expect(router.push).not.toHaveBeenCalled();
    expect(router.back).not.toHaveBeenCalled();
  });

  it("closes the dialog and stays when Hủy is pressed", () => {
    render(<SessionExitButton fallbackHref="/study/mode" />);

    fireEvent.click(screen.getByRole("button", { name: "Thoát phiên học" }));
    fireEvent.click(screen.getByRole("button", { name: "Hủy" }));

    expect(screen.queryByRole("dialog", { name: "Thoát phiên?" })).not.toBeInTheDocument();
    expect(router.push).not.toHaveBeenCalled();
    expect(router.back).not.toHaveBeenCalled();
  });

  it("goes back to the previous path when history is available", () => {
    Object.defineProperty(window.history, "length", { configurable: true, value: 3 });
    render(<SessionExitButton fallbackHref="/study/mode" />);

    fireEvent.click(screen.getByRole("button", { name: "Thoát phiên học" }));
    fireEvent.click(screen.getByRole("button", { name: "Thoát" }));

    expect(router.back).toHaveBeenCalledTimes(1);
    expect(router.push).not.toHaveBeenCalled();
  });

  it("falls back to the setup path when there is no history", () => {
    Object.defineProperty(window.history, "length", { configurable: true, value: 1 });
    render(<SessionExitButton fallbackHref="/study/mode" />);

    fireEvent.click(screen.getByRole("button", { name: "Thoát phiên học" }));
    fireEvent.click(screen.getByRole("button", { name: "Thoát" }));

    expect(router.push).toHaveBeenCalledWith("/study/mode");
    expect(router.back).not.toHaveBeenCalled();
  });
});
