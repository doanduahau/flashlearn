import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  CreateSourceChips,
  createSourceHref,
} from "@/features/flashcard-sets/components/create-source-chips";
import { SetLauncherCard } from "@/features/flashcard-sets/components/set-launcher-card";

describe("SetLauncherCard", () => {
  it("renders a navigation card pointing to the create page", () => {
    render(
      <SetLauncherCard
        href="/sets/create"
        mascotState="point-right"
        title="Tạo Flash card"
        description="Biến nội dung của bạn thành thẻ học"
        mascotLevel={1}
      />,
    );

    const card = screen.getByRole("link", { name: /Tạo Flash card/i });
    expect(card).toHaveAttribute("href", "/sets/create");
    expect(screen.getByText("Biến nội dung của bạn thành thẻ học")).toBeInTheDocument();
  });

  it("renders a navigation card pointing to the library", () => {
    render(
      <SetLauncherCard
        href="/sets/library"
        mascotState="normal"
        title="Flash card của bạn"
        description="Bộ thường và bộ đặc biệt"
        mascotLevel={1}
      />,
    );

    const card = screen.getByRole("link", { name: /Flash card của bạn/i });
    expect(card).toHaveAttribute("href", "/sets/library");
  });
});

describe("CreateSourceChips", () => {
  it("renders all four source chips with the correct hrefs", () => {
    render(<CreateSourceChips current="paste" />);

    expect(screen.getByRole("link", { name: /Dán nội dung/i })).toHaveAttribute(
      "href",
      "/sets/create",
    );
    expect(screen.getByRole("link", { name: /Google Sheets/i })).toHaveAttribute(
      "href",
      "/sets/create?source=google_sheets",
    );
    expect(screen.getByRole("link", { name: "Tài liệu" })).toHaveAttribute(
      "href",
      "/sets/create?source=file",
    );
    expect(screen.getByRole("link", { name: /Thủ công/i })).toHaveAttribute(
      "href",
      "/sets/create?source=manual",
    );
  });

  it("highlights the active source chip", () => {
    render(<CreateSourceChips current="paste" />);

    const active = screen.getByRole("link", { name: /Dán nội dung/i });
    expect(active).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("link", { name: "Tài liệu" })).not.toHaveAttribute("aria-current");
  });

  it("highlights a non-default source chip", () => {
    render(<CreateSourceChips current="file" />);

    expect(screen.getByRole("link", { name: "Tài liệu" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("link", { name: /Dán nội dung/i })).not.toHaveAttribute("aria-current");
  });
});

describe("createSourceHref", () => {
  it("uses the bare create page for the default paste source", () => {
    expect(createSourceHref("paste")).toBe("/sets/create");
    expect(createSourceHref("google_sheets")).toBe("/sets/create?source=google_sheets");
    expect(createSourceHref("file")).toBe("/sets/create?source=file");
    expect(createSourceHref("manual")).toBe("/sets/create?source=manual");
  });
});
