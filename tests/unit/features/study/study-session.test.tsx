import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import type { ReactNode } from "react";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  back: vi.fn(),
  updateCardCollections: vi.fn() as Mock,
  completeStudySession: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mocks.push,
    replace: mocks.replace,
    refresh: mocks.refresh,
    back: mocks.back,
  }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/features/special-collections/server/actions", () => ({
  updateCardCollections: mocks.updateCardCollections,
}));
vi.mock("@/features/study/server/actions", () => ({
  completeStudySession: mocks.completeStudySession,
}));

import { StudySession } from "@/features/study/components/study-session";
import type { MascotLevel } from "@/features/mascot/types/mascot-types";

const CARD_1 = {
  id: "11111111-1111-4111-8111-111111111111",
  front: "Mặt trước 1",
  back: "Mặt sau 1",
  setId: "22222222-2222-4222-8222-222222222222",
  setName: "Bộ một",
};
const CARD_2 = {
  id: "33333333-3333-4333-8333-333333333333",
  front: "Mặt trước 2",
  back: "Mặt sau 2",
  setId: "22222222-2222-4222-8222-222222222222",
  setName: "Bộ một",
};
const COLLECTIONS = [{ id: "44444444-4444-4444-8444-444444444444", name: "Khó nhớ" }];

function renderSession(
  overrides: Partial<{
    membershipsByCard: Record<string, string[]>;
    collections: typeof COLLECTIONS;
    truncated: boolean;
    seed: number;
    sessionHref: string;
    mascotLevel: MascotLevel;
  }> = {},
) {
  const props: {
    cards: (typeof CARD_1)[];
    collections: typeof COLLECTIONS;
    membershipsByCard: Record<string, string[]>;
    truncated: boolean;
    seed?: number;
    sessionHref: string;
    mascotLevel: MascotLevel;
  } = {
    cards: [CARD_1, CARD_2],
    collections: COLLECTIONS,
    membershipsByCard: {},
    truncated: false,
    sessionHref: "/study/session?sets=22222222-2222-4222-8222-222222222222",
    mascotLevel: 1,
    ...overrides,
  };
  return render(<StudySession {...props} />);
}

describe("StudySession", () => {
  beforeEach(() => {
    mocks.push.mockReset();
    mocks.replace.mockReset();
    mocks.refresh.mockReset();
    mocks.back.mockReset();
    mocks.updateCardCollections.mockReset();
    mocks.updateCardCollections.mockResolvedValue({ ok: true });
    mocks.completeStudySession.mockReset();
    mocks.completeStudySession.mockResolvedValue({ ok: true });
  });

  it("shows the first card front with progress 1 / 2", () => {
    renderSession();
    const front = screen.getByText("Mặt trước 1");
    expect(front.parentElement).toHaveAttribute("aria-hidden", "false");
    expect(screen.getByText("Mặt sau 1").parentElement).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuemax", "2");
  });

  it("flips between front and back", async () => {
    renderSession();
    fireEvent.keyDown(window, { key: " " });
    expect(screen.getByText("Mặt trước 1").parentElement).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("Mặt sau 1").parentElement).toHaveAttribute("aria-hidden", "false");
  });

  it("advances to the next card with keyboard ArrowDown and goes back with ArrowUp", async () => {
    renderSession();
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(screen.getByText("2 / 2")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "2");
    expect(screen.getByText("Mặt trước 2")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "ArrowUp" });
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
  });

  it("resets the flip when navigating to another card", async () => {
    renderSession();
    fireEvent.keyDown(window, { key: " " });
    expect(screen.getByText("Mặt sau 1").parentElement).toHaveAttribute("aria-hidden", "false");
    fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(screen.getByText("Mặt trước 2").parentElement).toHaveAttribute("aria-hidden", "false");
  });

  it("shows the completion screen on the last card instead of leaving the page", async () => {
    const user = userEvent.setup();
    renderSession();
    fireEvent.keyDown(window, { key: "ArrowDown" });
    await user.click(screen.getByRole("button", { name: /Hoàn thành/ }));
    expect(screen.getByRole("heading", { name: "Hoàn thành!" })).toBeInTheDocument();
    expect(screen.getByText("Đã xem 2 thẻ")).toBeInTheDocument();
    expect(document.querySelector("main img")).toHaveAttribute(
      "src",
      "/mascot/level-1/congrats.png",
    );
    expect(mocks.push).not.toHaveBeenCalled();
    expect(mocks.back).not.toHaveBeenCalled();
  });

  it("replays the session from the first card after completing", async () => {
    const user = userEvent.setup();
    renderSession();
    fireEvent.keyDown(window, { key: "ArrowDown" });
    await user.click(screen.getByRole("button", { name: /Hoàn thành/ }));
    await user.click(screen.getByRole("button", { name: /Chơi lại/ }));
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
    expect(screen.getByText("Mặt trước 1")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Hoàn thành/ })).not.toBeInTheDocument();
  });

  it("records daily activity and refreshes after completing", async () => {
    const user = userEvent.setup();
    renderSession();
    fireEvent.keyDown(window, { key: "ArrowDown" });
    await user.click(screen.getByRole("button", { name: /Hoàn thành/ }));
    // The completion screen renders immediately; the background save runs
    // after it, then refreshes so the streak updates without a reload.
    expect(screen.getByRole("heading", { name: "Hoàn thành!" })).toBeInTheDocument();
    expect(mocks.completeStudySession).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows the completion screen immediately and a retry prompt when recording fails", async () => {
    const user = userEvent.setup();
    mocks.completeStudySession.mockResolvedValue({
      ok: false,
      error: "Không thể cập nhật hoạt động hôm nay.",
    });
    renderSession();
    fireEvent.keyDown(window, { key: "ArrowDown" });
    await user.click(screen.getByRole("button", { name: /Hoàn thành/ }));
    expect(screen.getByRole("heading", { name: "Hoàn thành!" })).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Không thể cập nhật hoạt động hôm nay."),
    );
    expect(mocks.refresh).not.toHaveBeenCalled();

    mocks.completeStudySession.mockResolvedValue({ ok: true });
    await user.click(screen.getByRole("button", { name: /Thử lại/ }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(mocks.completeStudySession).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1));
  });

  it("goes back to the previous path when history is available after completing", async () => {
    const user = userEvent.setup();
    Object.defineProperty(window.history, "length", { configurable: true, value: 3 });
    renderSession();
    fireEvent.keyDown(window, { key: "ArrowDown" });
    await user.click(screen.getByRole("button", { name: /Hoàn thành/ }));
    await user.click(screen.getByRole("button", { name: /Thoát/ }));
    expect(mocks.back).toHaveBeenCalledTimes(1);
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("goes to the study mode selection when no history is available after completing", async () => {
    const user = userEvent.setup();
    Object.defineProperty(window.history, "length", { configurable: true, value: 1 });
    renderSession();
    fireEvent.keyDown(window, { key: "ArrowDown" });
    await user.click(screen.getByRole("button", { name: /Hoàn thành/ }));
    await user.click(screen.getByRole("button", { name: /Thoát/ }));
    expect(mocks.back).not.toHaveBeenCalled();
    expect(mocks.push).toHaveBeenCalledWith(
      "/study/mode?sets=22222222-2222-4222-8222-222222222222",
    );
  });

  it("exits back to the previous path when history is available", async () => {
    const user = userEvent.setup();
    Object.defineProperty(window.history, "length", { configurable: true, value: 3 });
    renderSession();
    await user.click(screen.getByRole("button", { name: /Thoát phiên học/ }));
    await user.click(screen.getByRole("button", { name: "Thoát" }));
    expect(mocks.back).toHaveBeenCalledTimes(1);
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("exits to the study mode selection when no history is available", async () => {
    const user = userEvent.setup();
    Object.defineProperty(window.history, "length", { configurable: true, value: 1 });
    renderSession();
    await user.click(screen.getByRole("button", { name: /Thoát phiên học/ }));
    await user.click(screen.getByRole("button", { name: "Thoát" }));
    expect(mocks.back).not.toHaveBeenCalled();
    expect(mocks.push).toHaveBeenCalledWith(
      "/study/mode?sets=22222222-2222-4222-8222-222222222222",
    );
  });

  it("shows the original set name for the current card", () => {
    renderSession();
    expect(screen.getByText("Bộ gốc")).toBeInTheDocument();
    expect(screen.getByText("Bộ một")).toBeInTheDocument();
  });

  it("opens the collection control and reflects the current card's memberships", async () => {
    const user = userEvent.setup();
    renderSession({
      membershipsByCard: { [CARD_1.id]: [COLLECTIONS[0].id], [CARD_2.id]: [] },
    });
    const trigger = screen.getByRole("button", { name: "Thêm vào bộ đặc biệt" });
    expect(trigger).toHaveAttribute("title", "Thêm vào bộ đặc biệt");
    await user.click(trigger);
    expect(screen.getByRole("checkbox", { name: "Khó nhớ" })).toBeChecked();
    await user.click(screen.getByRole("button", { name: /^Hủy$/i }));
    fireEvent.keyDown(window, { key: "ArrowDown" });
    await user.click(screen.getByRole("button", { name: "Thêm vào bộ đặc biệt" }));
    expect(screen.getByRole("checkbox", { name: "Khó nhớ" })).not.toBeChecked();
  });

  it("does not flip the card when opening the collection control", async () => {
    const user = userEvent.setup();
    renderSession();
    await user.click(screen.getByRole("button", { name: "Thêm vào bộ đặc biệt" }));
    expect(screen.getByText("Mặt trước 1").parentElement).toHaveAttribute("aria-hidden", "false");
  });

  it("does not navigate when opening the collection control", async () => {
    const user = userEvent.setup();
    renderSession();
    await user.click(screen.getByRole("button", { name: "Thêm vào bộ đặc biệt" }));
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
  });

  it("shows a notice when the session is truncated", () => {
    renderSession({ truncated: true });
    expect(screen.getByText(/Phiên giới hạn ở 1000 thẻ/)).toBeInTheDocument();
  });

  it("navigates with the arrow keys and flips with space", async () => {
    renderSession();
    fireEvent.keyDown(document.body, { key: "ArrowRight" });
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "2");
    fireEvent.keyDown(document.body, { key: "ArrowLeft" });
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
    fireEvent.keyDown(document.body, { key: " " });
    expect(screen.getByText("Mặt sau 1").parentElement).toHaveAttribute("aria-hidden", "false");
  });

  it("ignores keys while a form control is focused", () => {
    renderSession();
    const flipButton = screen.getByRole("button", { name: /Trộn thứ tự/ });
    fireEvent.keyDown(flipButton, { key: " " });
    fireEvent.keyDown(flipButton, { key: "ArrowDown" });
    expect(screen.getByText("Mặt trước 1").parentElement).toHaveAttribute("aria-hidden", "false");
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
  });

  it("ignores shortcuts while a control is focused", () => {
    renderSession();
    const back = screen.getByRole("button", { name: /Thoát phiên học/ });
    fireEvent.keyDown(back, { key: " " });
    fireEvent.keyDown(back, { key: "ArrowRight" });
    expect(screen.getByText("Mặt trước 1").parentElement).toHaveAttribute("aria-hidden", "false");
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
  });

  it("adds a seed to the url when shuffling", async () => {
    const user = userEvent.setup();
    renderSession();
    await user.click(screen.getByRole("button", { name: /Trộn thứ tự/ }));
    expect(mocks.replace).toHaveBeenCalledWith(
      expect.stringMatching(
        /^\/study\/session\?sets=22222222-2222-4222-8222-222222222222&seed=\d+$/,
      ),
      { scroll: false },
    );
  });

  it("removes the seed from the url when unshuffling", async () => {
    const user = userEvent.setup();
    renderSession({
      seed: 42,
      sessionHref: "/study/session?sets=22222222-2222-4222-8222-222222222222&seed=42",
    });
    await user.click(screen.getByRole("button", { name: /Bỏ trộn thứ tự/ }));
    expect(mocks.replace).toHaveBeenCalledWith(
      "/study/session?sets=22222222-2222-4222-8222-222222222222",
      { scroll: false },
    );
  });

  it("keeps mastery status off the study card so recall is not distracted", () => {
    renderSession();
    expect(
      screen.queryByRole("img", { name: /Chưa học|Cần ôn|Đang học|Đã nhớ/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Chưa học|Cần ôn|Đang học|Đã nhớ/)).not.toBeInTheDocument();
  });
});
