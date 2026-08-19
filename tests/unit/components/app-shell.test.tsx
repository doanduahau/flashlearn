import { render, screen, within } from "@testing-library/react";
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

    const logoLinks = screen.getAllByRole("link", { name: "CapyStudy" });
    expect(logoLinks).toHaveLength(2);
    logoLinks.forEach((link) => {
      expect(link).toHaveAttribute("href", "/dashboard");
    });
  });

  it("shows the streak indicator in the sidebar and the mobile header, and keeps user controls in sidebar only", () => {
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

    const header = screen.getByRole("banner");
    expect(within(header).queryByTestId("current-user")).not.toBeInTheDocument();
    expect(within(header).queryByTestId("sign-out-button")).not.toBeInTheDocument();

    const sidebar = screen.getByRole("complementary");
    expect(within(sidebar).getByTestId("current-user")).toBeInTheDocument();
    expect(within(sidebar).getByTestId("sign-out-button")).toBeInTheDocument();
  });

  it("links every streak indicator to the statistics tab", () => {
    render(
      <AppShell streak={2} completedToday={false}>
        <div>Page content</div>
      </AppShell>,
    );

    const indicators = screen.getAllByLabelText("Chuỗi 2 ngày, hôm nay chưa hoàn thành");
    expect(indicators).toHaveLength(2);
    indicators.forEach((indicator) => {
      const link = indicator.closest("a");
      expect(link).toHaveAttribute("href", "/profile?tab=statistics");
    });
  });

  it("shows the storage warning only when warn-mode observations exist", () => {
    const { rerender } = render(
      <AppShell storageQuotaWarning>
        <div>Page content</div>
      </AppShell>,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "Bạn đang dùng vượt một giới hạn sắp được áp dụng",
    );

    rerender(
      <AppShell storageQuotaWarning={false}>
        <div>Page content</div>
      </AppShell>,
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
