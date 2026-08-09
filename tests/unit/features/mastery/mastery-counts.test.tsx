import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MasteryCounts } from "@/features/mastery/components/mastery-counts";
import type { MasteryAggregate } from "@/features/mastery/utils/aggregate-mastery";

function aggregate(overrides: Partial<MasteryAggregate> = {}): MasteryAggregate {
  return {
    total: 0,
    untested: 0,
    review: 0,
    learning: 0,
    strong: 0,
    ...overrides,
  };
}

describe("MasteryCounts", () => {
  it("renders compact Cần ôn / Chưa học counts", () => {
    render(<MasteryCounts aggregate={aggregate({ review: 18, untested: 32 })} />);
    expect(screen.getByText("Cần ôn")).toBeInTheDocument();
    expect(screen.getByText("18")).toBeInTheDocument();
    expect(screen.getByText("Chưa học")).toBeInTheDocument();
    expect(screen.getByText("32")).toBeInTheDocument();
  });

  it("renders nothing when there are no cards needing review or study", () => {
    const { container } = render(
      <MasteryCounts aggregate={aggregate({ total: 40, learning: 12, strong: 28 })} />,
    );
    expect(container.textContent).toBe("");
  });

  it("hides a zero count so the summary stays minimal", () => {
    render(<MasteryCounts aggregate={aggregate({ review: 0, untested: 7 })} />);
    expect(screen.queryByText("Cần ôn")).not.toBeInTheDocument();
    expect(screen.getByText("Chưa học")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("does not expose a raw mastery percentage or score", () => {
    render(<MasteryCounts aggregate={aggregate({ review: 18, untested: 32, total: 50 })} />);
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    expect(screen.queryByText(/score|điểm|phần trăm/i)).not.toBeInTheDocument();
  });

  it("keeps the status colors on decorative dots with the meaning in text", () => {
    const { container } = render(
      <MasteryCounts aggregate={aggregate({ review: 2, untested: 3 })} />,
    );
    const dots = container.querySelectorAll("span[aria-hidden='true']");
    expect(dots).toHaveLength(2);
    expect(dots[0]?.className).toContain("bg-mastery-review-dot");
    expect(dots[1]?.className).toContain("bg-mastery-untested-dot");
  });
});
