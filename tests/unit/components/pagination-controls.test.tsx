import { render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props} />
  ),
}));

import { PaginationControls } from "@/components/shared/pagination-controls";

describe("PaginationControls", () => {
  it("disables previous only on page one and links forward", () => {
    render(<PaginationControls page={1} totalPages={2} pageHref={(page) => `?page=${page}`} />);

    expect(screen.queryByRole("link", { name: "Trước" })).not.toBeInTheDocument();
    expect(screen.getByText("Trước")).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("link", { name: "Sau" })).toHaveAttribute("href", "?page=2");
  });

  it("links page two back to page one and disables next at the final page", () => {
    render(
      <PaginationControls page={2} totalPages={2} pageHref={(page) => `?page=${page}&q=thẻ`} />,
    );

    expect(screen.getByRole("link", { name: "Trước" })).toHaveAttribute("href", "?page=1&q=thẻ");
    expect(screen.queryByRole("link", { name: "Sau" })).not.toBeInTheDocument();
    expect(screen.getByText("Sau")).toHaveAttribute("aria-disabled", "true");
  });
});
