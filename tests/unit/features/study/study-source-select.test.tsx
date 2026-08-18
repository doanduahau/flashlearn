import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

import { StudySourceSelect } from "@/features/study/components/study-source-select";

const SET_A_ID = "11111111-1111-4111-8111-111111111111";
const SET_B_ID = "22222222-2222-4222-8222-222222222222";
const COLLECTION_ID = "33333333-3333-4333-8333-333333333333";

const SETS = [
  { id: SET_A_ID, name: "Bộ A", cardCount: 2 },
  { id: SET_B_ID, name: "Bộ B", cardCount: 2 },
];
const COLLECTIONS = [{ id: COLLECTION_ID, name: "Khó nhớ", cardCount: 1 }];

describe("StudySourceSelect", () => {
  beforeEach(() => {
    mocks.push.mockReset();
  });

  it("defaults to all cards with the total count and an enabled start button", () => {
    render(
      <StudySourceSelect sets={SETS} collections={COLLECTIONS} totalCards={4} mascotLevel={1} />,
    );
    const allCard = screen.getByRole("radio", { name: "Tất cả 4 thẻ" });
    expect(allCard).toBeChecked();
    expect(screen.getByText("4 thẻ")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Bắt đầu học/ })).toBeEnabled();
  });

  it("starts an all-cards session", async () => {
    const user = userEvent.setup();
    render(
      <StudySourceSelect sets={SETS} collections={COLLECTIONS} totalCards={4} mascotLevel={1} />,
    );
    await user.click(screen.getByRole("button", { name: /Bắt đầu học/ }));
    expect(mocks.push).toHaveBeenCalledWith("/study/mode?all=1");
  });

  it("prevents starting an all-cards session when there are no cards", () => {
    render(
      <StudySourceSelect sets={SETS} collections={COLLECTIONS} totalCards={0} mascotLevel={1} />,
    );
    expect(screen.getByRole("button", { name: /Bắt đầu học/ })).toBeDisabled();
  });

  it("shows an immediate single-source count when one source is selected", async () => {
    const user = userEvent.setup();
    render(
      <StudySourceSelect sets={SETS} collections={COLLECTIONS} totalCards={4} mascotLevel={1} />,
    );
    await user.click(screen.getByRole("checkbox", { name: /Bộ A/ }));
    expect(screen.getByText("1 nguồn · 2 thẻ")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Bắt đầu học/ })).toBeEnabled();
  });

  it("shows the immediate summed count for multiple selected sources", async () => {
    const user = userEvent.setup();
    render(
      <StudySourceSelect sets={SETS} collections={COLLECTIONS} totalCards={4} mascotLevel={1} />,
    );
    await user.click(screen.getByRole("checkbox", { name: /Bộ A/ }));
    await user.click(screen.getByRole("checkbox", { name: /Khó nhớ/ }));
    expect(screen.getByText("2 nguồn · 3 thẻ")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Bắt đầu học/ })).toBeEnabled();
  });

  it("shows an immediate collection-only count when only a collection is selected", async () => {
    const user = userEvent.setup();
    render(
      <StudySourceSelect sets={SETS} collections={COLLECTIONS} totalCards={4} mascotLevel={1} />,
    );
    await user.click(screen.getByRole("checkbox", { name: /Khó nhớ/ }));
    expect(screen.getByText("1 nguồn · 1 thẻ")).toBeInTheDocument();
  });

  it("never shows a counting placeholder and keeps start enabled after selecting", async () => {
    const user = userEvent.setup();
    render(
      <StudySourceSelect sets={SETS} collections={COLLECTIONS} totalCards={4} mascotLevel={1} />,
    );
    await user.click(screen.getByRole("checkbox", { name: /Bộ A/ }));
    await user.click(screen.getByRole("checkbox", { name: /Khó nhớ/ }));
    expect(screen.queryByText("Đang tính thẻ…")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Bắt đầu học/ })).toBeEnabled();
  });

  it("shows zero and disables start when the selection is emptied", async () => {
    const user = userEvent.setup();
    render(
      <StudySourceSelect sets={SETS} collections={COLLECTIONS} totalCards={4} mascotLevel={1} />,
    );
    await user.click(screen.getByRole("checkbox", { name: /Bộ A/ }));
    expect(screen.getByText("1 nguồn · 2 thẻ")).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: /Bộ A/ }));
    expect(screen.getByText("0 nguồn · 0 thẻ")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Bắt đầu học/ })).toBeDisabled();
  });

  it("starts a custom session and redirects with the chosen source ids", async () => {
    const user = userEvent.setup();
    render(
      <StudySourceSelect sets={SETS} collections={COLLECTIONS} totalCards={4} mascotLevel={1} />,
    );
    await user.click(screen.getByRole("checkbox", { name: /Bộ A/ }));
    await user.click(screen.getByRole("button", { name: /Bắt đầu học/ }));
    expect(mocks.push).toHaveBeenCalledWith(`/study/mode?sets=${SET_A_ID}`);
  });

  it("starts a custom session and redirects with both sets and collections in the query", async () => {
    const user = userEvent.setup();
    render(
      <StudySourceSelect sets={SETS} collections={COLLECTIONS} totalCards={4} mascotLevel={1} />,
    );
    await user.click(screen.getByRole("checkbox", { name: /Bộ A/ }));
    await user.click(screen.getByRole("checkbox", { name: /Khó nhớ/ }));
    await user.click(screen.getByRole("button", { name: /Bắt đầu học/ }));
    expect(mocks.push).toHaveBeenCalledWith(
      `/study/mode?sets=${SET_A_ID}&collections=${COLLECTION_ID}`,
    );
  });

  it("restores custom source selection passed back from mode selection", () => {
    render(
      <StudySourceSelect
        sets={SETS}
        collections={COLLECTIONS}
        totalCards={4}
        initialSource={{ all: false, setIds: [SET_A_ID], collectionIds: [] }}
        mascotLevel={1}
      />,
    );
    expect(screen.getByRole("checkbox", { name: /Bộ A/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Tất cả 4 thẻ" })).not.toBeChecked();
  });

  it("restores a custom selection and shows the immediate summed count", () => {
    render(
      <StudySourceSelect
        sets={SETS}
        collections={COLLECTIONS}
        totalCards={4}
        initialSource={{ all: false, setIds: [SET_A_ID], collectionIds: [COLLECTION_ID] }}
        mascotLevel={1}
      />,
    );
    expect(screen.getByText("2 nguồn · 3 thẻ")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Bắt đầu học/ })).toBeEnabled();
  });

  it("returns to the all-cards total when the user selects all", async () => {
    const user = userEvent.setup();
    render(
      <StudySourceSelect sets={SETS} collections={COLLECTIONS} totalCards={4} mascotLevel={1} />,
    );
    await user.click(screen.getByRole("checkbox", { name: /Bộ A/ }));
    expect(screen.getByText("1 nguồn · 2 thẻ")).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Tất cả 4 thẻ" }));
    expect(screen.getByText("4 thẻ")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Bắt đầu học/ })).toBeEnabled();
  });

  it("keeps the immediate count in sync when unchecking and rechecking a source", async () => {
    const user = userEvent.setup();
    render(
      <StudySourceSelect sets={SETS} collections={COLLECTIONS} totalCards={4} mascotLevel={1} />,
    );
    await user.click(screen.getByRole("checkbox", { name: /Bộ A/ }));
    expect(screen.getByText("1 nguồn · 2 thẻ")).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: /Bộ A/ }));
    expect(screen.getByText("0 nguồn · 0 thẻ")).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: /Bộ A/ }));
    expect(screen.getByText("1 nguồn · 2 thẻ")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Bắt đầu học/ })).toBeEnabled();
  });

  it("shows zero for an empty custom selection restored from mode selection", () => {
    render(
      <StudySourceSelect
        sets={SETS}
        collections={COLLECTIONS}
        totalCards={4}
        initialSource={{ all: false, setIds: [], collectionIds: [] }}
        mascotLevel={1}
      />,
    );
    expect(screen.getByText("0 nguồn · 0 thẻ")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Bắt đầu học/ })).toBeDisabled();
  });

  it("disables start when the selected sources sum to zero cards", async () => {
    const user = userEvent.setup();
    render(
      <StudySourceSelect
        sets={[{ id: SET_A_ID, name: "Bộ rỗng", cardCount: 0 }]}
        collections={[]}
        totalCards={0}
        mascotLevel={1}
      />,
    );
    await user.click(screen.getByRole("checkbox", { name: /Bộ rỗng/ }));
    expect(screen.getByText("1 nguồn · 0 thẻ")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Bắt đầu học/ })).toBeDisabled();
  });

  it("renders an empty state with an import link when there are no sources", () => {
    render(<StudySourceSelect sets={[]} collections={[]} totalCards={0} mascotLevel={1} />);
    expect(screen.getByText("Chưa có thẻ flashcard để học.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Nhập tệp đầu tiên/ })).toHaveAttribute(
      "href",
      "/sets/create?source=file",
    );
  });
});
