import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LocalTimePreview } from "@/features/profile/components/local-time-preview";

describe("LocalTimePreview", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-06T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the current local time in the selected timezone", () => {
    render(<LocalTimePreview timezone="Asia/Ho_Chi_Minh" />);
    expect(screen.getByText(/Giờ địa phương ở Asia\/Ho_Chi_Minh/)).toHaveTextContent(
      "06/08/2026 07:00",
    );
  });

  it("renders a different local date/time for a negative-offset zone", () => {
    render(<LocalTimePreview timezone="Pacific/Pago_Pago" />);
    expect(screen.getByText(/Giờ địa phương ở Pacific\/Pago_Pago/)).toHaveTextContent(
      "05/08/2026 13:00",
    );
  });

  it("refreshes the displayed time when the interval fires", () => {
    vi.setSystemTime(new Date("2026-08-06T00:00:00Z"));
    render(<LocalTimePreview timezone="UTC" />);
    expect(screen.getByText(/Giờ địa phương ở UTC/)).toHaveTextContent("00:00");

    vi.setSystemTime(new Date("2026-08-06T01:00:00Z"));
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.getByText(/Giờ địa phương ở UTC/)).toHaveTextContent("01:01");
  });
});
