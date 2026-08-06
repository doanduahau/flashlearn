import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StreakSummary } from "@/features/statistics/components/streak-summary";

describe("StreakSummary", () => {
  it("shows an active, readable streak state without relying on animation", () => {
    render(<StreakSummary streak={7} completedToday />);

    expect(screen.getByLabelText("Chuỗi 7 ngày, hôm nay đã hoàn thành")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("Hôm nay đã hoàn thành")).toBeInTheDocument();
  });

  it("keeps the count and exposes an inactive state", () => {
    render(<StreakSummary streak={0} completedToday={false} />);

    expect(screen.getByLabelText("Chuỗi 0 ngày, hôm nay chưa hoàn thành")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.getByText("Hôm nay chưa hoàn thành")).toBeInTheDocument();
  });
});
