import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MasteryCardContent } from "@/features/mastery/components/mastery-card-content";
import { masteryCardClassName } from "@/features/mastery/presentation/mastery-presentation";
import type { MasteryStatus } from "@/features/mastery/types/mastery-types";

function renderCard(status: MasteryStatus, badge = "#1") {
  return render(
    <li className={masteryCardClassName(status)}>
      <div className="flex min-w-0 items-start gap-3">
        <MasteryCardContent status={status} badge={badge} front="Mặt trước" back="Mặt sau" />
      </div>
    </li>,
  );
}

describe("MasteryCardContent", () => {
  it("renders badge, front and back without changing density", () => {
    renderCard("untested");
    expect(screen.getByText("#1")).toBeInTheDocument();
    expect(screen.getByText("Mặt trước")).toBeInTheDocument();
    expect(screen.getByText("Mặt sau")).toBeInTheDocument();
  });

  it("renders an untested card with the neutral card treatment", () => {
    const { container } = renderCard("untested");
    const card = container.querySelector("li");
    expect(card?.className).toContain("bg-mastery-untested");
    expect(card?.className).toContain("border-mastery-untested-border");
    expect(screen.getByRole("img", { name: "Chưa học" })).toBeInTheDocument();
  });

  it("renders a review card with the soft-red treatment", () => {
    const { container } = renderCard("review");
    const card = container.querySelector("li");
    expect(card?.className).toContain("bg-mastery-review");
    expect(card?.className).toContain("border-mastery-review-border");
    expect(screen.getByRole("img", { name: "Cần ôn" })).toBeInTheDocument();
  });

  it("renders a learning card with the soft-yellow treatment", () => {
    const { container } = renderCard("learning");
    const card = container.querySelector("li");
    expect(card?.className).toContain("bg-mastery-learning");
    expect(card?.className).toContain("border-mastery-learning-border");
    expect(screen.getByRole("img", { name: "Đang học" })).toBeInTheDocument();
  });

  it("renders a strong card with the soft-green treatment", () => {
    const { container } = renderCard("strong");
    const card = container.querySelector("li");
    expect(card?.className).toContain("bg-mastery-strong");
    expect(card?.className).toContain("border-mastery-strong-border");
    expect(screen.getByRole("img", { name: "Đã nhớ" })).toBeInTheDocument();
  });

  it("keeps the same base card sizing for every status", () => {
    for (const status of ["untested", "review", "learning", "strong"] as const) {
      const { container, unmount } = renderCard(status);
      const card = container.querySelector("li");
      expect(card?.className).toContain("rounded-2xl");
      expect(card?.className).toContain("p-4 sm:p-5");
      unmount();
    }
  });

  it("applies the same presentation for a set badge and a collection badge", () => {
    const setView = renderCard("review", "#3");
    expect(setView.getByText("#3")).toBeInTheDocument();
    setView.unmount();
    const collectionView = renderCard("review", "Bộ gốc A");
    expect(collectionView.getByText("Bộ gốc A")).toBeInTheDocument();
    expect(collectionView.getByRole("img", { name: "Cần ôn" })).toBeInTheDocument();
  });

  it("never renders a raw score or percentage", () => {
    const { container } = renderCard("learning");
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    expect(container.textContent).not.toMatch(/%|score|điểm|phần trăm/i);
  });

  it("exposes the mastery meaning accessibly without relying only on color", () => {
    renderCard("strong");
    const indicator = screen.getByRole("img", { name: "Đã nhớ" });
    expect(indicator).toHaveAttribute("aria-label", "Đã nhớ");
    expect(indicator).toHaveAttribute("title", "Đã nhớ");
  });
});
