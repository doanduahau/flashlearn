import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OfflineBanner } from "@/components/shared/offline-banner";

function setOnline(online: boolean): void {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    value: online,
  });
}

function fireOnlineEvent(online: boolean): void {
  window.dispatchEvent(new Event(online ? "online" : "offline"));
}

describe("OfflineBanner", () => {
  beforeEach(() => {
    setOnline(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders nothing when online", () => {
    render(<OfflineBanner />);
    expect(screen.queryByText(/Bạn đang offline/)).not.toBeInTheDocument();
  });

  it("renders the offline message when the browser starts offline", () => {
    setOnline(false);
    render(<OfflineBanner />);
    expect(screen.getByText(/Bạn đang offline/)).toBeInTheDocument();
    expect(screen.getByText(/dữ liệu có thể chưa mới nhất/)).toBeInTheDocument();
  });

  it("appears when the window goes offline and disappears when it comes back online", () => {
    render(<OfflineBanner />);
    expect(screen.queryByText(/Bạn đang offline/)).not.toBeInTheDocument();

    act(() => {
      fireOnlineEvent(false);
    });
    expect(screen.getByText(/Bạn đang offline/)).toBeInTheDocument();

    act(() => {
      fireOnlineEvent(true);
    });
    expect(screen.queryByText(/Bạn đang offline/)).not.toBeInTheDocument();
  });

  it("exposes an accessible status announcement", () => {
    setOnline(false);
    render(<OfflineBanner />);
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
  });
});
