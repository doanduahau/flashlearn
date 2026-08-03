import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Loading from "@/app/loading";

describe("Loading", () => {
  it("disables the spinner animation for users who prefer reduced motion", () => {
    render(<Loading />);

    expect(screen.getByRole("status", { name: "Đang tải" })).toHaveClass(
      "motion-reduce:animate-none",
    );
  });
});
