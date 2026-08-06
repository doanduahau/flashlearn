import { render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props} />
  ),
}));

import { SectionTabs } from "@/components/shared/section-tabs";

describe("SectionTabs", () => {
  it("keeps the canonical selected tab in the URL and labels the active tab", () => {
    render(
      <SectionTabs
        label="Loại bộ flashcard"
        current="special"
        items={[
          { value: "regular", label: "Bộ thường", href: "/sets?tab=regular" },
          { value: "special", label: "Bộ đặc biệt", href: "/sets?tab=special" },
        ]}
      />,
    );

    expect(screen.getByRole("navigation", { name: "Loại bộ flashcard" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Bộ thường" })).toHaveAttribute(
      "href",
      "/sets?tab=regular",
    );
    expect(screen.getByRole("link", { name: "Bộ đặc biệt" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
