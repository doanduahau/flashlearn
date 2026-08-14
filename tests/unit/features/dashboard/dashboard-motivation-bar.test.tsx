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
});
