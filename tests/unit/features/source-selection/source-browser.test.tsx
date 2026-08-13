import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace }) }));

import { SourceBrowser } from "@/features/source-selection/components/source-browser";
import type { SourceOption, SourcePage } from "@/features/source-selection/types/source-types";

const SOURCE_A: SourceOption = {
  id: "11111111-1111-4111-8111-111111111111",
  kind: "regular",
  name: "Bộ A",
  cardCount: 12,
};
const SOURCE_B: SourceOption = {
  id: "22222222-2222-4222-8222-222222222222",
  kind: "special",
  name: "Khó nhớ",
  cardCount: 5,
};
const PAGE_ONE: SourcePage = {
  sources: [SOURCE_A, SOURCE_B],
  page: 1,
  totalPages: 2,
  query: "",
  type: "all",
};
const LARGE_PAGE_ONE: SourcePage = {
  ...PAGE_ONE,
  sources: Array.from({ length: 12 }, (_, index) => ({
    id: `${String(index + 1).padStart(8, "0")}-1111-4111-8111-111111111111`,
    kind: "regular" as const,
    name: `Bộ lớn ${index + 1}`,
    cardCount: 10,
  })),
};

describe("SourceBrowser", () => {
  it("searches, filters and paginates through URL state", async () => {
    const user = userEvent.setup();
    render(
      <SourceBrowser
        path="/study"
        sourcePage={PAGE_ONE}
        selected={[]}
        onToggle={vi.fn()}
        allCount={17}
        allSelected={true}
        onSelectAll={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText("Tìm nguồn theo tên"), "React");
    await user.click(screen.getByRole("button", { name: "Tìm" }));
    expect(mocks.replace).toHaveBeenLastCalledWith("/study?q=React", { scroll: false });

    await user.click(screen.getByRole("button", { name: "Bộ đặc biệt" }));
    expect(mocks.replace).toHaveBeenLastCalledWith("/study?sourceType=special", {
      scroll: false,
    });

    await user.click(screen.getByRole("button", { name: "Sau" }));
    expect(mocks.replace).toHaveBeenLastCalledWith("/study?page=2", { scroll: false });
  });

  it("keeps a selected source from a large first page when a later page loads", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<SelectionHarness sourcePage={LARGE_PAGE_ONE} />);
    await user.click(screen.getByRole("checkbox", { name: /^Bộ lớn 1,/ }));
    expect(screen.getByLabelText("Nguồn đã chọn")).toHaveTextContent("Bộ lớn 1");

    rerender(<SelectionHarness sourcePage={{ ...LARGE_PAGE_ONE, sources: [SOURCE_B], page: 2 }} />);
    expect(screen.getByLabelText("Nguồn đã chọn")).toHaveTextContent("Bộ lớn 1");
  });
});

function SelectionHarness({ sourcePage }: Readonly<{ sourcePage: SourcePage }>) {
  const [selected, setSelected] = useState<SourceOption[]>([]);
  return (
    <SourceBrowser
      path="/quiz"
      sourcePage={sourcePage}
      selected={selected}
      onToggle={(source) =>
        setSelected((current) =>
          current.some((item) => item.id === source.id && item.kind === source.kind)
            ? current.filter((item) => item.id !== source.id || item.kind !== source.kind)
            : [...current, source],
        )
      }
      allCount={0}
      allSelected={false}
      onSelectAll={() => setSelected([])}
    />
  );
}
