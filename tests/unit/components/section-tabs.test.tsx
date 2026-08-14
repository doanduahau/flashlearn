import { render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";
import { describe, expect, it, vi } from "vitest";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

vi.mock("next/link", () => ({
  default: ({
    href,
    scroll,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; scroll?: boolean }) => (
    <a href={href} data-scroll={String(scroll)} {...props} />
  ),
}));

import { SectionTabs } from "@/components/shared/section-tabs";

describe("SectionTabs", () => {
  it("keeps the canonical selected tab in the URL, labels the active tab, and disables scroll reset", () => {
    render(
      <SectionTabs
        label="Loại bộ flashcard"
        current="special"
        items={[
          { value: "regular", label: "Bộ thường", href: "/sets/library?tab=regular" },
          { value: "special", label: "Bộ đặc biệt", href: "/sets/library?tab=special" },
        ]}
        pendingContent={<p>Đang tải nội dung bộ flashcard</p>}
      >
        <p>Nội dung bộ đặc biệt</p>
      </SectionTabs>,
    );

    expect(screen.getByRole("navigation", { name: "Loại bộ flashcard" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Bộ thường" })).toHaveAttribute(
      "href",
      "/sets/library?tab=regular",
    );
    expect(screen.getByRole("link", { name: "Bộ thường" })).toHaveAttribute("data-scroll", "false");
    expect(screen.getByRole("link", { name: "Bộ đặc biệt" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
