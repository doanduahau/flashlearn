import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PageSkeleton } from "@/components/shared/page-skeleton";

describe("PageSkeleton", () => {
  it("renders with default status role and aria-label", () => {
    render(<PageSkeleton />);

    const skeleton = screen.getByRole("status");
    expect(skeleton).toBeInTheDocument();
    expect(skeleton).toHaveAttribute("aria-label", "Đang tải trang");
  });

  it("renders with custom title in aria-label", () => {
    render(<PageSkeleton title="Đang tải danh sách bộ" />);

    const skeleton = screen.getByRole("status");
    expect(skeleton).toHaveAttribute("aria-label", "Đang tải danh sách bộ");
  });
});
