import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StreakMilestoneBanner } from "@/features/dashboard/components/streak-milestone-banner";

describe("StreakMilestoneBanner", () => {
  it.each([
    [30, 2],
    [60, 3],
    [120, 4],
    [240, 5],
  ] as const)("renders only at the exact %s-day milestone", (streak, level) => {
    const { container } = render(<StreakMilestoneBanner streak={streak} />);

    expect(screen.getByText(`Chúc mừng! Bạn đã đạt chuỗi ${streak} ngày`)).toBeInTheDocument();
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      `/mascot/level-${level}/congrats.png`,
    );
  });

  it.each([0, 35])("does not render outside an exact milestone (%s)", (streak) => {
    const { container } = render(<StreakMilestoneBanner streak={streak} />);

    expect(container).toBeEmptyDOMElement();
  });
});
