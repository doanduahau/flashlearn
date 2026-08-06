import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StreakIndicator } from "@/features/statistics/components/streak-indicator";

describe("StreakIndicator", () => {
  it("shows an active streak with an accessible label", () => {
    render(<StreakIndicator streak={7} completedToday />);

    const chip = screen.getByLabelText("Chuỗi 7 ngày, hôm nay đã hoàn thành");
    expect(chip).toHaveAttribute("title", "Chuỗi 7 ngày, hôm nay đã hoàn thành");
    expect(chip).toHaveTextContent("7");
    expect(chip.querySelector("svg")).not.toBeNull();
  });

  it("keeps a readable inactive state", () => {
    render(<StreakIndicator streak={0} completedToday={false} />);

    expect(screen.getByLabelText("Chuỗi 0 ngày, hôm nay chưa hoàn thành")).toHaveTextContent("0");
  });
});
