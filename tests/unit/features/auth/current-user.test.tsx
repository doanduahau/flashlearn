import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  getProfile: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser: mocks.getUser },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: mocks.getProfile,
        }),
      }),
    }),
  }),
}));

import { CurrentUser, initialsOf } from "@/features/auth/components/current-user";

function signInAs(email: string, displayName: string | null): void {
  mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1", email } } });
  mocks.getProfile.mockResolvedValue({
    data: { display_name: displayName, avatar_url: null },
  });
}

describe("CurrentUser", () => {
  beforeEach(() => {
    mocks.getUser.mockReset();
    mocks.getProfile.mockReset();
  });

  it("shows initials avatar and the display name on one line", async () => {
    signInAs("user@example.com", "Nguyễn Văn A");
    render(<CurrentUser />);

    expect(await screen.findByText("NV")).toBeInTheDocument();
    const name = screen.getByText("Nguyễn Văn A");
    expect(name).toHaveClass("truncate");
    expect(name).toHaveAttribute("aria-label", "Nguyễn Văn A (user@example.com)");
  });

  it("does not render the full email as permanently visible text", async () => {
    signInAs("user@example.com", "Nguyễn Văn A");
    const { container } = render(<CurrentUser />);

    await screen.findByText("NV");
    const name = screen.getByText("Nguyễn Văn A");
    expect(name.textContent).toBe("Nguyễn Văn A");

    const tooltip = screen.getByText("user@example.com");
    expect(tooltip).toHaveAttribute("role", "tooltip");
    expect(tooltip).toHaveClass("opacity-0");
    expect(container.querySelector("span.truncate")).not.toBeNull();
  });

  it("falls back to the email local part when the display name is empty", async () => {
    signInAs("someone.else@example.com", null);
    render(<CurrentUser />);

    expect(await screen.findByText("someone.else")).toBeInTheDocument();
    expect(screen.getByText("S")).toBeInTheDocument();
  });

  it("never wraps a long display name", async () => {
    const longName = "Rất dài ".repeat(20).trim();
    signInAs("user@example.com", longName);
    const { container } = render(<CurrentUser />);

    const name = await screen.findByText(longName);
    expect(name).toHaveClass("truncate");

    const row = name.closest("div");
    expect(row?.className).toContain("min-w-0");
    expect(container.querySelectorAll("span.truncate")).toHaveLength(1);
  });

  it("shows a generic user icon when initials cannot be derived", async () => {
    signInAs("@example.com", null);
    const { container } = render(<CurrentUser />);

    await screen.findByText("@example.com");
    expect(container.querySelector("svg")).not.toBeNull();
  });
});

describe("initialsOf", () => {
  it("derives initials from the first two words", () => {
    expect(initialsOf("Nguyễn Văn A")).toBe("NV");
    expect(initialsOf("John Paul Jones")).toBe("JP");
    expect(initialsOf("John")).toBe("J");
    expect(initialsOf("  user   name  ")).toBe("UN");
  });

  it("returns an empty string when no initials can be derived", () => {
    expect(initialsOf("")).toBe("");
    expect(initialsOf("   ")).toBe("");
  });
});
