import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { SharedCardsList } from "@/features/sharing/components/shared-cards-list";

function cards(count: number): { id: string; front: string; back: string }[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `card-${index}`,
    front: `Front ${index + 1}`,
    back: `Back ${index + 1}`,
  }));
}

describe("SharedCardsList", () => {
  it("renders all cards without pagination when at or below 50", () => {
    render(<SharedCardsList cards={cards(2)} />);
    expect(screen.getByText("Front 1")).toBeInTheDocument();
    expect(screen.getByText("Front 2")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Phân trang" })).not.toBeInTheDocument();
  });

  it("paginates at 50 cards per page", async () => {
    const user = userEvent.setup();
    render(<SharedCardsList cards={cards(55)} />);

    expect(screen.getByText("Front 1")).toBeInTheDocument();
    expect(screen.getByText("Front 50")).toBeInTheDocument();
    expect(screen.queryByText("Front 51")).not.toBeInTheDocument();
    expect(screen.getByText(/Trang 1 \/ 2/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Sau/i }));
    expect(screen.getByText("Front 51")).toBeInTheDocument();
    expect(screen.queryByText("Front 1")).not.toBeInTheDocument();
    expect(screen.getByText(/Trang 2 \/ 2/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Trước/i }));
    expect(screen.getByText("Front 1")).toBeInTheDocument();
  });

  it("disables navigation at the first and last page", async () => {
    const user = userEvent.setup();
    render(<SharedCardsList cards={cards(60)} />);

    const previous = screen.getByText("Trước");
    expect(previous).toHaveAttribute("aria-disabled", "true");

    await user.click(screen.getByRole("button", { name: /Sau/i }));
    const next = screen.getByText("Sau");
    expect(next).toHaveAttribute("aria-disabled", "true");
  });
});
