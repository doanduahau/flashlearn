import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CreateSetCard } from "@/features/flashcard-sets/components/create-set-card";
import { LibraryCard } from "@/features/flashcard-sets/components/library-card";

describe("CreateSetCard", () => {
  it("shows the create card header and all four source chips when collapsed", () => {
    render(
      <CreateSetCard mode={null} searchParams={{}}>
        <div />
      </CreateSetCard>,
    );

    expect(screen.getByText("Tạo Flash card")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Dán nội dung/i })).toHaveAttribute(
      "href",
      "/sets?create=paste",
    );
    expect(screen.getByRole("link", { name: /Google Sheets/i })).toHaveAttribute(
      "href",
      "/sets?create=google_sheets",
    );
    expect(screen.getByRole("link", { name: "Tài liệu" })).toHaveAttribute(
      "href",
      "/sets?create=document",
    );
    expect(screen.getByRole("link", { name: /Thủ công/i })).toHaveAttribute(
      "href",
      "/sets?create=manual",
    );
  });

  it("highlights the active source chip", () => {
    render(
      <CreateSetCard mode="paste" searchParams={{}}>
        <div />
      </CreateSetCard>,
    );

    const active = screen.getByRole("link", { name: /Dán nội dung/i });
    expect(active).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("link", { name: "Tài liệu" })).not.toHaveAttribute("aria-current");
  });

  it("renders the source content and a close link when a mode is active", () => {
    render(
      <CreateSetCard mode="file" searchParams={{}}>
        <div>nội dung tài liệu</div>
      </CreateSetCard>,
    );

    expect(screen.getByText("nội dung tài liệu")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Đóng" })).toHaveAttribute("href", "/sets");
  });

  it("supports the legacy import deep link as the file source", () => {
    render(
      <CreateSetCard mode="file" searchParams={{}}>
        <div />
      </CreateSetCard>,
    );

    expect(screen.getByRole("link", { name: /Tài liệu/i })).toHaveAttribute("aria-current", "true");
  });
});

describe("LibraryCard", () => {
  it("renders children when open", () => {
    render(
      <LibraryCard open>
        <div>danh sách bộ</div>
      </LibraryCard>,
    );

    expect(screen.getByText("Flash card của bạn")).toBeInTheDocument();
    expect(screen.getByText("danh sách bộ")).toBeInTheDocument();
  });

  it("hides children when closed", () => {
    render(
      <LibraryCard open={false}>
        <div>danh sách bộ</div>
      </LibraryCard>,
    );

    expect(screen.getByText("Flash card của bạn")).toBeInTheDocument();
    expect(screen.queryByText("danh sách bộ")).not.toBeInTheDocument();
  });
});
