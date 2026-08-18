import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BrandSplash } from "@/components/shared/brand-splash";

describe("BrandSplash", () => {
  it("renders with default status role and aria-label", () => {
    render(<BrandSplash />);

    const splash = screen.getByRole("status");
    expect(splash).toBeInTheDocument();
    expect(splash).toHaveAttribute("role", "status");
    expect(splash).toHaveAttribute("aria-label", "Đang tải trang");
  });

  it("renders with custom title in aria-label", () => {
    render(<BrandSplash title="Đang tải danh sách bộ" />);

    const splash = screen.getByRole("status");
    expect(splash).toHaveAttribute("aria-label", "Đang tải danh sách bộ");
  });
});
