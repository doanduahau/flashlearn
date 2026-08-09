import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MasteryIndicator } from "@/features/mastery/components/mastery-indicator";
import type { MasteryStatus } from "@/features/mastery/types/mastery-types";

describe("MasteryIndicator", () => {
  it("renders an accessible neutral status for untested cards", () => {
    render(<MasteryIndicator status="untested" />);
    const indicator = screen.getByRole("img", { name: "Chưa học" });
    expect(indicator).toHaveAttribute("title", "Chưa học");
  });

  it("renders an accessible soft-red status for review cards", () => {
    render(<MasteryIndicator status="review" />);
    expect(screen.getByRole("img", { name: "Cần ôn" })).toHaveAttribute("title", "Cần ôn");
  });

  it("renders an accessible soft-yellow status for learning cards", () => {
    render(<MasteryIndicator status="learning" />);
    expect(screen.getByRole("img", { name: "Đang học" })).toHaveAttribute("title", "Đang học");
  });

  it("renders an accessible soft-green status for strong cards", () => {
    render(<MasteryIndicator status="strong" />);
    expect(screen.getByRole("img", { name: "Đã nhớ" })).toHaveAttribute("title", "Đã nhớ");
  });

  it("carries the status color only on the inner decorative dot", () => {
    const { container } = render(<MasteryIndicator status="strong" />);
    const dot = container.querySelector("span[aria-hidden='true']");
    expect(dot).not.toBeNull();
    expect(dot?.className).toContain("bg-mastery-strong-dot");
    expect(dot?.className).toContain("rounded-full");
  });

  it("never renders a raw score or percentage", () => {
    const { container } = render(
      <div>
        <MasteryIndicator status="learning" />
        <MasteryIndicator status="review" />
      </div>,
    );
    expect(screen.queryByText(/\d/)).not.toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    expect(container.textContent).not.toMatch(/score|điểm|phần trăm/i);
  });

  it("provides a label for every mastery status without relying on color alone", () => {
    const statuses: readonly MasteryStatus[] = ["untested", "review", "learning", "strong"];
    const expectedNames = ["Chưa học", "Cần ôn", "Đang học", "Đã nhớ"];
    const view = render(
      <div>
        {statuses.map((status) => (
          <MasteryIndicator key={status} status={status} />
        ))}
      </div>,
    );
    for (const name of expectedNames) {
      expect(view.getByRole("img", { name })).toBeInTheDocument();
    }
  });
});
