import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { MasteryLegend } from "@/features/mastery/components/mastery-legend";

describe("MasteryLegend", () => {
  it("starts collapsed without cluttering the card list", () => {
    render(<MasteryLegend />);
    expect(screen.getByRole("button", { name: "Trạng thái học" })).toBeInTheDocument();
    expect(screen.queryByText("Cần ôn", { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByText("Đang học", { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByText("Đã nhớ", { exact: true })).not.toBeInTheDocument();
  });

  it("reveals the four status meanings on demand", async () => {
    const user = userEvent.setup();
    render(<MasteryLegend />);
    await user.click(screen.getByRole("button", { name: "Trạng thái học" }));
    expect(screen.getByText("Chưa học", { exact: true })).toBeVisible();
    expect(screen.getByText("Cần ôn", { exact: true })).toBeVisible();
    expect(screen.getByText("Đang học", { exact: true })).toBeVisible();
    expect(screen.getByText("Đã nhớ", { exact: true })).toBeVisible();
  });

  it("closes with Escape and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    render(<MasteryLegend />);
    const trigger = screen.getByRole("button", { name: "Trạng thái học" });
    await user.click(trigger);
    expect(screen.getByRole("region", { name: "Chú thích trạng thái học" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("toggles closed again when the trigger is clicked", async () => {
    const user = userEvent.setup();
    render(<MasteryLegend />);
    const trigger = screen.getByRole("button", { name: "Trạng thái học" });
    await user.click(trigger);
    await user.click(trigger);
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });

  it("uses a semantic accessible label instead of relying on color alone", () => {
    render(<MasteryLegend />);
    const trigger = screen.getByRole("button", { name: "Trạng thái học" });
    expect(trigger).toHaveAttribute("aria-label", "Trạng thái học");
    expect(trigger).toHaveAttribute("title", "Trạng thái học");
  });
});
