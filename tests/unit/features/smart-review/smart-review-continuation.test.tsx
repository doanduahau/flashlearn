import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/smart-review/components/start-smart-review-button", () => ({
  StartSmartReviewButton: ({ label }: { label?: string }) => <button type="button">{label}</button>,
}));

import { SmartReviewContinuation } from "@/features/smart-review/components/smart-review-continuation";

describe("SmartReviewContinuation", () => {
  it("shows the fresh remaining count with a compact continuation action", () => {
    render(<SmartReviewContinuation remainingCount={18} />);

    expect(screen.getByText("Còn 18 thẻ cần ôn")).toBeVisible();
    expect(screen.getByRole("button", { name: "Ôn tiếp" })).toBeVisible();
  });

  it("shows a subtle completion state without a disabled continuation", () => {
    render(<SmartReviewContinuation remainingCount={0} />);

    expect(screen.getByText("Đã ôn xong hôm nay")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Ôn tiếp" })).not.toBeInTheDocument();
  });
});
