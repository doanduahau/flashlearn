import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import type { ReactNode } from "react";

const mocks = vi.hoisted(() => ({
  getStudyCardCount: vi.fn() as Mock,
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@/features/study/server/actions", () => ({
  getStudyCardCount: mocks.getStudyCardCount,
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
    mocks.getStudyCardCount.mockReset();
    mocks.push.mockReset();
    mocks.getStudyCardCount.mockResolvedValue({ ok: true, count: 2 });
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

  it("shows a loading state while the unique count is being computed", async () => {
    let resolveCount: ((result: { ok: true; count: number }) => void) | undefined;
    mocks.getStudyCardCount.mockReturnValue(
      new Promise((resolve) => {
        resolveCount = resolve;
      }),
    );
    const user = userEvent.setup();
    render(
      <StudySourceSelect sets={SETS} collections={COLLECTIONS} totalCards={4} mascotLevel={1} />,
    );
    await user.click(screen.getByRole("checkbox", { name: /Bộ A/ }));
    expect(screen.getByText("Đang tính thẻ…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Bắt đầu học/ })).toBeDisabled();
    resolveCount?.({ ok: true, count: 2 });
    await waitFor(() => expect(screen.getByText("1 nguồn · 2 thẻ")).toBeInTheDocument());
  });

  it("fetches a deduplicated count when a set is selected", async () => {
    const user = userEvent.setup();
    render(
      <StudySourceSelect sets={SETS} collections={COLLECTIONS} totalCards={4} mascotLevel={1} />,
    );
    await user.click(screen.getByRole("checkbox", { name: /Bộ A/ }));
    await waitFor(() =>
      expect(mocks.getStudyCardCount).toHaveBeenCalledWith({
        setIds: [SET_A_ID],
        collectionIds: [],
      }),
    );
    await waitFor(() => expect(screen.getByText("1 nguồn · 2 thẻ")).toBeInTheDocument());
  });

  it("combines sets and collections into a unique count", async () => {
    const user = userEvent.setup();
    render(
      <StudySourceSelect sets={SETS} collections={COLLECTIONS} totalCards={4} mascotLevel={1} />,
    );
    await user.click(screen.getByRole("checkbox", { name: /Bộ A/ }));
    await user.click(screen.getByRole("checkbox", { name: /Khó nhớ/ }));
    await waitFor(() =>
      expect(mocks.getStudyCardCount).toHaveBeenCalledWith({
        setIds: [SET_A_ID],
        collectionIds: [COLLECTION_ID],
      }),
    );
  });

  it("shows zero and disables start when the selection is emptied", async () => {
    mocks.getStudyCardCount.mockImplementation(
      (input: { setIds: string[]; collectionIds: string[] }) =>
        Promise.resolve({ ok: true, count: input.setIds.includes(SET_A_ID) ? 2 : 0 }),
    );
    const user = userEvent.setup();
    render(
      <StudySourceSelect sets={SETS} collections={COLLECTIONS} totalCards={4} mascotLevel={1} />,
    );
    await user.click(screen.getByRole("checkbox", { name: /Bộ A/ }));
    await waitFor(() => expect(screen.getByText("1 nguồn · 2 thẻ")).toBeInTheDocument());
    await user.click(screen.getByRole("checkbox", { name: /Bộ A/ }));
    await waitFor(() => expect(screen.getByText("0 nguồn · 0 thẻ")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /Bắt đầu học/ })).toBeDisabled();
  });

  it("starts a custom session and redirects with the chosen source ids", async () => {
    const user = userEvent.setup();
    render(
      <StudySourceSelect sets={SETS} collections={COLLECTIONS} totalCards={4} mascotLevel={1} />,
    );
    await user.click(screen.getByRole("checkbox", { name: /Bộ A/ }));
    await waitFor(() => expect(screen.getByText("1 nguồn · 2 thẻ")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /Bắt đầu học/ }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith(`/study/mode?sets=${SET_A_ID}`));
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

  it("re-checks the count on start and shows an error when the selection is empty", async () => {
    mocks.getStudyCardCount
      .mockResolvedValueOnce({ ok: true, count: 2 })
      .mockResolvedValueOnce({ ok: true, count: 0 });
    const user = userEvent.setup();
    render(
      <StudySourceSelect sets={SETS} collections={COLLECTIONS} totalCards={4} mascotLevel={1} />,
    );
    await user.click(screen.getByRole("checkbox", { name: /Bộ A/ }));
    await waitFor(() => expect(screen.getByText("1 nguồn · 2 thẻ")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /Bắt đầu học/ }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Chưa có thẻ nào trong phạm vi đã chọn."),
    );
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("shows a recoverable error when the count action fails", async () => {
    mocks.getStudyCardCount.mockResolvedValue({
      ok: false,
      error: "Phiên đăng nhập đã hết hạn.",
    });
    const user = userEvent.setup();
    render(
      <StudySourceSelect sets={SETS} collections={COLLECTIONS} totalCards={4} mascotLevel={1} />,
    );
    await user.click(screen.getByRole("checkbox", { name: /Bộ A/ }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Phiên đăng nhập đã hết hạn."),
    );
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
