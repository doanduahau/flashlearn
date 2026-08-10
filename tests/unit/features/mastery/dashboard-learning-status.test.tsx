import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DashboardLearningStatus } from "@/features/mastery/components/dashboard-learning-status";
import type { MasteryAggregate } from "@/features/mastery/utils/aggregate-mastery";

const masteryAggregate: MasteryAggregate = {
  total: 12,
  untested: 4,
  review: 2,
  learning: 3,
  strong: 3,
};

describe("DashboardLearningStatus", () => {
  it("keeps Mastery review semantic while presenting separate FSRS actionable count", () => {
    render(
      <DashboardLearningStatus
        masteryAggregate={masteryAggregate}
        smartReviewActionableCount={10}
      />,
    );

    expect(screen.getByText("Cần ôn").parentElement).toHaveTextContent("10");
    expect(screen.getByText("Chưa học").parentElement).toHaveTextContent("4");
    expect(masteryAggregate.review).toBe(2);
  });
});
