import { cleanup, render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ pathname: "/profile" }));

vi.mock("next/navigation", () => ({ usePathname: () => mocks.pathname }));
vi.mock("next/link", () => ({
  default: ({ href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props} />
  ),
}));

import { AppNavigation } from "@/components/layout/app-navigation";

afterEach(cleanup);

describe("AppNavigation", () => {
  it("labels the dashboard destination as Tổng quan", () => {
    render(<AppNavigation variant="sidebar" />);

    expect(screen.getByRole("link", { name: "Tổng quan" })).toHaveAttribute("href", "/dashboard");
  });

  it("renders exactly five mobile primary destinations and marks Cá nhân active", () => {
    render(<AppNavigation variant="bottom" />);

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(5);
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/dashboard",
      "/sets",
      "/study",
      "/quiz",
      "/profile",
    ]);
    expect(screen.getByRole("link", { name: "Cá nhân" })).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
