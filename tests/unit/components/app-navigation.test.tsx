import { cleanup, render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ pathname: "/statistics" }));

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

  it("renders exactly five mobile primary slots and marks overflow routes through More", () => {
    render(<AppNavigation variant="bottom" />);

    expect(screen.getAllByRole("link")).toHaveLength(4);
    expect(screen.getByRole("button")).toHaveAttribute("aria-current", "page");
  });

  it("reveals overflow destinations accessibly", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    render(<AppNavigation variant="bottom" />);

    await user.click(screen.getByRole("button"));
    const links = screen.getAllByRole("link");
    expect(links.find((link) => link.getAttribute("href") === "/statistics")).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(links.some((link) => link.getAttribute("href") === "/settings")).toBe(true);
  });
});
