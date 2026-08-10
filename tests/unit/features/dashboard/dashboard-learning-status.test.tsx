import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DashboardLearningStatus } from "@/features/dashboard/components/dashboard-learning-status";
import {
  aggregateMastery,
  type MasteryAggregate,
} from "@/features/mastery/utils/aggregate-mastery";

describe("DashboardLearningStatus", () => {
  it("uses explicit FSRS/New lifecycle counts rather than a MasteryAggregate", () => {
    const masteryAggregate: MasteryAggregate = aggregateMastery([
      { status: "review" },
      { status: "untested" },
      { status: "learning" },
    ]);

    render(<DashboardLearningStatus dueCount={8} newCardsCount={12} />);

    expect(screen.getByText("Cần ôn")).toBeInTheDocument();
    expect(screen.getByText("Chưa học")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(masteryAggregate.review).toBe(1);
    expect(masteryAggregate.untested).toBe(1);
  });

  it("does not render a normal empty summary when both lifecycle counts are zero", () => {
    const { container } = render(<DashboardLearningStatus dueCount={0} newCardsCount={0} />);
    expect(container.textContent).toBe("");
  });
});
