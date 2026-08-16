import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MilestoneMascots } from "@/features/mascot/components/milestone-mascots";

describe("MilestoneMascots", () => {
  it("renders all 5 streak milestone levels with correct labels and highlights active level", () => {
    render(<MilestoneMascots mascotLevel={3} />);

    expect(screen.getByRole("heading", { name: "Cột mốc streak" })).toBeInTheDocument();

    expect(screen.getByLabelText("Cột mốc Level 1 — chưa đạt")).toBeInTheDocument();
    expect(screen.getByLabelText("Cột mốc 30 ngày streak — chưa đạt")).toBeInTheDocument();
    expect(screen.getByLabelText("Cột mốc 60 ngày streak — đã đạt")).toBeInTheDocument();
    expect(screen.getByLabelText("Cột mốc 120 ngày streak — chưa đạt")).toBeInTheDocument();
    expect(screen.getByLabelText("Cột mốc 240 ngày streak — chưa đạt")).toBeInTheDocument();

    expect(screen.getByText("Level 1")).toBeInTheDocument();
    expect(screen.getByText("30")).toBeInTheDocument();
    expect(screen.getByText("60")).toBeInTheDocument();
    expect(screen.getByText("120")).toBeInTheDocument();
    expect(screen.getByText("240")).toBeInTheDocument();
  });
});
