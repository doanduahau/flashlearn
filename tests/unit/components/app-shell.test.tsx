import { render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

vi.mock("next/link", () => ({
  default: ({ href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props} />
  ),
}));

vi.mock("@/features/auth/components/current-user", () => ({
  CurrentUser: () => <div data-testid="current-user">User</div>,
}));

vi.mock("@/features/auth/components/sign-out-button", () => ({
  SignOutButton: () => <button data-testid="sign-out-button">Sign out</button>,
}));

import { AppShell } from "@/components/layout/app-shell";

describe("AppShell", () => {
  it("renders the logo as internal links to the dashboard", () => {
    render(
      <AppShell>
        <div>Page content</div>
      </AppShell>,
    );

    const logoLinks = screen.getAllByRole("link", { name: "FlashLearn" });
    expect(logoLinks).toHaveLength(2);
    logoLinks.forEach((link) => {
      expect(link).toHaveAttribute("href", "/dashboard");
    });
  });

  it("shows the streak indicator in the sidebar and the mobile header", () => {
    render(
      <AppShell streak={5} completedToday>
        <div>Page content</div>
      </AppShell>,
    );

    const indicators = screen.getAllByLabelText("Chuỗi 5 ngày, hôm nay đã hoàn thành");
    expect(indicators).toHaveLength(2);
    indicators.forEach((indicator) => {
      expect(indicator).toHaveTextContent("5");
    });
  });
});
