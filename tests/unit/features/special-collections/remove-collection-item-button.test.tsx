import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  removeCollectionItem: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/features/special-collections/server/actions", () => ({
  removeCollectionItem: mocks.removeCollectionItem,
}));

import { RemoveCollectionItemButton } from "@/features/special-collections/components/remove-collection-item-button";

const COLLECTION_ID = "11111111-1111-4111-8111-111111111111";
const CARD_ID = "22222222-2222-4222-8222-222222222222";

describe("RemoveCollectionItemButton", () => {
  beforeEach(() => {
    mocks.removeCollectionItem.mockReset();
    mocks.refresh.mockReset();
    mocks.removeCollectionItem.mockResolvedValue({ ok: true });
  });

  it("renders a remove trigger", () => {
    render(<RemoveCollectionItemButton collectionId={COLLECTION_ID} cardId={CARD_ID} />);
    expect(screen.getByRole("button", { name: /bỏ thẻ/i })).toBeInTheDocument();
  });

  it("requires explicit confirmation before removing", async () => {
    const user = userEvent.setup();
    render(<RemoveCollectionItemButton collectionId={COLLECTION_ID} cardId={CARD_ID} />);
    await user.click(screen.getByRole("button", { name: /bỏ thẻ/i }));
    expect(screen.getByText(/bỏ thẻ này khỏi bộ đặc biệt/i)).toBeInTheDocument();
    expect(screen.getByText(/thẻ gốc trong bộ flashcard không bị xóa/i)).toBeInTheDocument();
    expect(mocks.removeCollectionItem).not.toHaveBeenCalled();
  });

  it("removes the item and refreshes on confirmation", async () => {
    const user = userEvent.setup();
    render(<RemoveCollectionItemButton collectionId={COLLECTION_ID} cardId={CARD_ID} />);
    await user.click(screen.getByRole("button", { name: /bỏ thẻ/i }));
    await user.click(screen.getByRole("button", { name: /bỏ thẻ/i }));
    await waitFor(() =>
      expect(mocks.removeCollectionItem).toHaveBeenCalledWith({
        collectionId: COLLECTION_ID,
        cardId: CARD_ID,
      }),
    );
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("shows a recoverable error and resets the confirmation", async () => {
    mocks.removeCollectionItem.mockResolvedValue({
      ok: false,
      error: "Không tìm thấy thẻ trong bộ.",
    });
    const user = userEvent.setup();
    render(<RemoveCollectionItemButton collectionId={COLLECTION_ID} cardId={CARD_ID} />);
    await user.click(screen.getByRole("button", { name: /bỏ thẻ/i }));
    await user.click(screen.getByRole("button", { name: /bỏ thẻ/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Không tìm thấy thẻ trong bộ.");
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(screen.queryByText(/bỏ thẻ này khỏi bộ đặc biệt/i)).not.toBeInTheDocument();
  });

  it("prevents duplicate submission while pending", async () => {
    let resolveAction: ((result: { ok: true }) => void) | undefined;
    mocks.removeCollectionItem.mockReturnValue(
      new Promise((resolve) => {
        resolveAction = resolve;
      }),
    );
    const user = userEvent.setup();
    render(<RemoveCollectionItemButton collectionId={COLLECTION_ID} cardId={CARD_ID} />);
    await user.click(screen.getByRole("button", { name: /bỏ thẻ/i }));
    const confirm = screen.getByRole("button", { name: /bỏ thẻ/i });
    await user.click(confirm);
    expect(confirm).toBeDisabled();
    await user.click(confirm);
    expect(mocks.removeCollectionItem).toHaveBeenCalledTimes(1);
    resolveAction?.({ ok: true });
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1));
  });
});
