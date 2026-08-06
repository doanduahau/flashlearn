import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import type { ReactNode } from "react";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  updateCardCollections: vi.fn() as Mock,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, replace: mocks.replace }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@/features/special-collections/server/actions", () => ({
  updateCardCollections: mocks.updateCardCollections,
}));

import { StudySession } from "@/features/study/components/study-session";

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
  }> = {},
) {
  const props = {
    cards: [CARD_1, CARD_2],
    collections: COLLECTIONS,
    membershipsByCard: {},
    truncated: false,
    sessionHref: "/study/session?sets=22222222-2222-4222-8222-222222222222",
    ...overrides,
  };
  return render(<StudySession {...props} />);
}

describe("StudySession", () => {
  beforeEach(() => {
    mocks.push.mockReset();
    mocks.replace.mockReset();
    mocks.updateCardCollections.mockReset();
    mocks.updateCardCollections.mockResolvedValue({ ok: true });
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
    const user = userEvent.setup();
    renderSession();
    await user.click(screen.getByRole("button", { name: /Nhấn để lật/ }));
    expect(screen.getByText("Mặt trước 1").parentElement).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("Mặt sau 1").parentElement).toHaveAttribute("aria-hidden", "false");
    expect(screen.getByRole("button", { name: /Nhấn để xem mặt trước/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("disables previous on the first card and advances to the next", async () => {
    const user = userEvent.setup();
    renderSession();
    expect(screen.getByRole("button", { name: /Thẻ trước/ })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /Thẻ tiếp theo/ }));
    expect(screen.getByText("2 / 2")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "2");
    expect(screen.getByText("Mặt trước 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Thẻ trước/ })).toBeEnabled();
  });

  it("resets the flip when navigating to another card", async () => {
    const user = userEvent.setup();
    renderSession();
    await user.click(screen.getByRole("button", { name: /Nhấn để lật/ }));
    expect(screen.getByRole("button", { name: /Nhấn để xem mặt trước/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Thẻ tiếp theo/ }));
    expect(screen.getByRole("button", { name: /Nhấn để lật/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("finishes the session on the last card", async () => {
    const user = userEvent.setup();
    renderSession();
    await user.click(screen.getByRole("button", { name: /Thẻ tiếp theo/ }));
    await user.click(screen.getByRole("button", { name: /Hoàn thành/ }));
    expect(mocks.push).toHaveBeenCalledWith("/study");
  });

  it("exits to the study selection", async () => {
    const user = userEvent.setup();
    renderSession();
    await user.click(screen.getByRole("button", { name: /Thoát/ }));
    expect(mocks.push).toHaveBeenCalledWith("/study");
  });

  it("shows the original set name for the current card", () => {
    renderSession();
    expect(screen.getByText("Bộ gốc")).toBeInTheDocument();
    expect(screen.getByText("Bộ một")).toBeInTheDocument();
  });

  it("shows the current card's membership count and updates when navigating", async () => {
    const user = userEvent.setup();
    renderSession({
      membershipsByCard: { [CARD_1.id]: [COLLECTIONS[0].id], [CARD_2.id]: [] },
    });
    expect(screen.getByRole("button", { name: "Bộ đặc biệt (1)" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Thẻ tiếp theo/ }));
    expect(screen.getByRole("button", { name: "Bộ đặc biệt (0)" })).toBeInTheDocument();
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
    expect(screen.getByRole("button", { name: /Nhấn để xem mặt trước/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("ignores keys while a form control is focused", () => {
    renderSession();
    const prevButton = screen.getByRole("button", { name: /Thẻ trước/ });
    fireEvent.keyDown(prevButton, { key: " " });
    fireEvent.keyDown(prevButton, { key: "ArrowRight" });
    expect(screen.getByRole("button", { name: /Nhấn để lật/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
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
});
