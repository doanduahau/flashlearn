import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ViewTransition } from "@/components/shared/view-transition";
import { ViewTransitionLink } from "@/components/shared/view-transition-link";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

describe("ViewTransition Components", () => {
  it("renders children wrapped in ViewTransition", () => {
    render(
      <ViewTransition name="test-transition">
        <span>Content</span>
      </ViewTransition>,
    );

    expect(screen.getByText("Content")).toBeInTheDocument();
  });

  it("renders ViewTransitionLink with standard href", () => {
    render(<ViewTransitionLink href="/sets">Danh sách bộ</ViewTransitionLink>);

    const link = screen.getByRole("link", { name: "Danh sách bộ" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/sets");
  });
});
