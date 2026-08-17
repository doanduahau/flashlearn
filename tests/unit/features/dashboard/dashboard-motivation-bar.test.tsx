import { render } from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props} />
  ),
}));

import { DashboardMotivationBar } from "@/features/dashboard/components/dashboard-motivation-bar";

describe("DashboardMotivationBar", () => {
  it("uses the happy mascot after activity is completed today", () => {
    const { container } = render(<DashboardMotivationBar completedToday mascotLevel={2} />);

    expect(container.querySelector("img")).toHaveAttribute("src", "/mascot/level-2/happy.png");
    expect(container.querySelector("img")).toHaveAttribute("loading", "eager");
  });

  it("uses the point-right mascot when activity is still needed today", () => {
    const { container } = render(<DashboardMotivationBar completedToday={false} mascotLevel={4} />);

    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "/mascot/level-4/point-right.png",
    );
  });

  it("shows the recovery message with the remaining quiz count", () => {
    const { container } = render(
      <DashboardMotivationBar
        completedToday={false}
        recoverable
        needsRecoveryQuizzes={2}
        mascotLevel={3}
      />,
    );

    expect(container.querySelector("#daily-motivation-heading")).toHaveTextContent(
      "Làm 2 bài chế độ kiểm tra để khôi phục streak",
    );
    expect(container.querySelector("img")).toHaveAttribute("src", "/mascot/level-3/happy.png");
  });

  it("keeps the default message when no recovery state is provided", () => {
    const { container } = render(<DashboardMotivationBar completedToday={false} mascotLevel={1} />);
    expect(container.querySelector("#daily-motivation-heading")).toHaveTextContent(
      "Chưa làm bài hôm nay",
    );
  });
});
