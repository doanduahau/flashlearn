import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import type { ReactNode } from "react";

const mocks = vi.hoisted(() => ({
  updateCardCollections: vi.fn() as Mock,
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@/features/special-collections/server/actions", () => ({
  updateCardCollections: mocks.updateCardCollections,
}));

import { CardCollectionsControl } from "@/features/special-collections/components/card-collections-control";

const CARD_ID = "22222222-2222-4222-8222-222222222222";
const SET_ID = "11111111-1111-4111-8111-111111111111";
const COLLECTION_A = "33333333-3333-4333-8333-333333333333";
const COLLECTION_B = "44444444-4444-4444-8444-444444444444";
const COLLECTIONS = [
  { id: COLLECTION_A, name: "Khó nhớ" },
  { id: COLLECTION_B, name: "Yêu thích" },
];

describe("CardCollectionsControl", () => {
  beforeEach(() => {
    mocks.updateCardCollections.mockReset();
    mocks.refresh.mockReset();
    mocks.updateCardCollections.mockResolvedValue({ ok: true });
  });

  it("links to the collection list when no collections exist", () => {
    render(
      <CardCollectionsControl cardId={CARD_ID} setId={SET_ID} collections={[]} memberships={[]} />,
    );
    const link = screen.getByRole("link", { name: /tạo bộ đặc biệt/i });
    expect(link).toHaveAttribute("href", "/collections");
  });

  it("shows the membership count on the trigger", () => {
    render(
      <CardCollectionsControl
        cardId={CARD_ID}
        setId={SET_ID}
        collections={COLLECTIONS}
        memberships={[COLLECTION_A]}
      />,
    );
    expect(screen.getByRole("button", { name: /bộ đặc biệt \(1\)/i })).toBeInTheDocument();
  });

  it("pre-checks collections the card already belongs to", async () => {
    const user = userEvent.setup();
    render(
      <CardCollectionsControl
        cardId={CARD_ID}
        setId={SET_ID}
        collections={COLLECTIONS}
        memberships={[COLLECTION_A]}
      />,
    );
    await user.click(screen.getByRole("button", { name: /bộ đặc biệt \(1\)/i }));
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes[0]).toBeChecked();
    expect(checkboxes[1]).not.toBeChecked();
  });

  it("saves the selected collections and refreshes", async () => {
    const user = userEvent.setup();
    render(
      <CardCollectionsControl
        cardId={CARD_ID}
        setId={SET_ID}
        collections={COLLECTIONS}
        memberships={[]}
      />,
    );
    await user.click(screen.getByRole("button", { name: /bộ đặc biệt \(0\)/i }));
    await user.click(screen.getByRole("checkbox", { name: /khó nhớ/i }));
    await user.click(screen.getByRole("button", { name: /^lưu$/i }));
    await waitFor(() =>
      expect(mocks.updateCardCollections).toHaveBeenCalledWith({
        cardId: CARD_ID,
        setId: SET_ID,
        collectionIds: [COLLECTION_A],
      }),
    );
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("removes a collection by unchecking it", async () => {
    const user = userEvent.setup();
    render(
      <CardCollectionsControl
        cardId={CARD_ID}
        setId={SET_ID}
        collections={COLLECTIONS}
        memberships={[COLLECTION_A, COLLECTION_B]}
      />,
    );
    await user.click(screen.getByRole("button", { name: /bộ đặc biệt \(2\)/i }));
    await user.click(screen.getByRole("checkbox", { name: /khó nhớ/i }));
    await user.click(screen.getByRole("button", { name: /^lưu$/i }));
    await waitFor(() =>
      expect(mocks.updateCardCollections).toHaveBeenCalledWith({
        cardId: CARD_ID,
        setId: SET_ID,
        collectionIds: [COLLECTION_B],
      }),
    );
  });

  it("shows a recoverable error and keeps the panel open", async () => {
    mocks.updateCardCollections.mockResolvedValue({ ok: false, error: "Không thể lưu." });
    const user = userEvent.setup();
    render(
      <CardCollectionsControl
        cardId={CARD_ID}
        setId={SET_ID}
        collections={COLLECTIONS}
        memberships={[]}
      />,
    );
    await user.click(screen.getByRole("button", { name: /bộ đặc biệt \(0\)/i }));
    await user.click(screen.getByRole("button", { name: /^lưu$/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Không thể lưu.");
    expect(screen.getByRole("button", { name: /^lưu$/i })).toBeInTheDocument();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("prevents duplicate submission while pending", async () => {
    let resolveAction: ((result: { ok: true }) => void) | undefined;
    mocks.updateCardCollections.mockReturnValue(
      new Promise((resolve) => {
        resolveAction = resolve;
      }),
    );
    const user = userEvent.setup();
    render(
      <CardCollectionsControl
        cardId={CARD_ID}
        setId={SET_ID}
        collections={COLLECTIONS}
        memberships={[]}
      />,
    );
    await user.click(screen.getByRole("button", { name: /bộ đặc biệt \(0\)/i }));
    const save = screen.getByRole("button", { name: /^lưu$/i });
    await user.click(save);
    expect(save).toBeDisabled();
    await user.click(save);
    expect(mocks.updateCardCollections).toHaveBeenCalledTimes(1);
    resolveAction?.({ ok: true });
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1));
  });

  it("cancels and resets the selection to the saved memberships", async () => {
    const user = userEvent.setup();
    render(
      <CardCollectionsControl
        cardId={CARD_ID}
        setId={SET_ID}
        collections={COLLECTIONS}
        memberships={[COLLECTION_A]}
      />,
    );
    await user.click(screen.getByRole("button", { name: /bộ đặc biệt \(1\)/i }));
    await user.click(screen.getByRole("checkbox", { name: /khó nhớ/i }));
    await user.click(screen.getByRole("button", { name: /hủy/i }));
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(mocks.updateCardCollections).not.toHaveBeenCalled();
  });

  it("renders an icon trigger with an accessible label and tooltip", () => {
    render(
      <CardCollectionsControl
        cardId={CARD_ID}
        setId={SET_ID}
        collections={COLLECTIONS}
        memberships={[]}
        variant="icon"
      />,
    );
    const trigger = screen.getByRole("button", { name: "Thêm vào bộ đặc biệt" });
    expect(trigger).toHaveAttribute("title", "Thêm vào bộ đặc biệt");
    expect(trigger.querySelector("svg")).not.toBeNull();
  });

  it("opens the selector from the icon trigger", async () => {
    const user = userEvent.setup();
    render(
      <CardCollectionsControl
        cardId={CARD_ID}
        setId={SET_ID}
        collections={COLLECTIONS}
        memberships={[COLLECTION_A]}
        variant="icon"
      />,
    );
    await user.click(screen.getByRole("button", { name: "Thêm vào bộ đặc biệt" }));
    expect(screen.getByRole("checkbox", { name: /khó nhớ/i })).toBeChecked();
  });

  it("returns focus to the icon trigger after saving", async () => {
    const user = userEvent.setup();
    render(
      <CardCollectionsControl
        cardId={CARD_ID}
        setId={SET_ID}
        collections={COLLECTIONS}
        memberships={[]}
        variant="icon"
      />,
    );
    const trigger = screen.getByRole("button", { name: "Thêm vào bộ đặc biệt" });
    await user.click(trigger);
    await user.click(screen.getByRole("button", { name: /^lưu$/i }));
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("returns focus to the icon trigger after cancelling", async () => {
    const user = userEvent.setup();
    render(
      <CardCollectionsControl
        cardId={CARD_ID}
        setId={SET_ID}
        collections={COLLECTIONS}
        memberships={[]}
        variant="icon"
      />,
    );
    const trigger = screen.getByRole("button", { name: "Thêm vào bộ đặc biệt" });
    await user.click(trigger);
    await user.click(screen.getByRole("button", { name: /hủy/i }));
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
