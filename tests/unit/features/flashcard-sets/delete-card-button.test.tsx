import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  deleteCard: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/features/flashcard-sets/server/actions", () => ({ deleteCard: mocks.deleteCard }));

import { DeleteCardButton } from "@/features/flashcard-sets/components/delete-card-button";

const SET_ID = "11111111-1111-4111-8111-111111111111";
const CARD_ID = "22222222-2222-4222-8222-222222222222";

describe("DeleteCardButton", () => {
  beforeEach(() => {
    mocks.deleteCard.mockReset();
    mocks.refresh.mockReset();
    mocks.deleteCard.mockResolvedValue({ ok: true });
  });

  it("renders a delete trigger", () => {
    render(<DeleteCardButton setId={SET_ID} cardId={CARD_ID} />);
    expect(screen.getByRole("button", { name: /xóa thẻ/i })).toBeInTheDocument();
  });

  it("requires explicit confirmation before deleting", async () => {
    const user = userEvent.setup();
    render(<DeleteCardButton setId={SET_ID} cardId={CARD_ID} />);
    await user.click(screen.getByRole("button", { name: /xóa thẻ/i }));
    expect(screen.getByText(/xóa thẻ này/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /xóa vĩnh viễn/i })).toBeInTheDocument();
    expect(mocks.deleteCard).not.toHaveBeenCalled();
  });

  it("cancels the confirmation without deleting", async () => {
    const user = userEvent.setup();
    render(<DeleteCardButton setId={SET_ID} cardId={CARD_ID} />);
    await user.click(screen.getByRole("button", { name: /xóa thẻ/i }));
    await user.click(screen.getByRole("button", { name: /hủy/i }));
    expect(screen.queryByText(/xóa thẻ này/i)).not.toBeInTheDocument();
    expect(mocks.deleteCard).not.toHaveBeenCalled();
  });

  it("deletes the card and refreshes on confirmation", async () => {
    const user = userEvent.setup();
    render(<DeleteCardButton setId={SET_ID} cardId={CARD_ID} />);
    await user.click(screen.getByRole("button", { name: /xóa thẻ/i }));
    await user.click(screen.getByRole("button", { name: /xóa vĩnh viễn/i }));
    await waitFor(() =>
      expect(mocks.deleteCard).toHaveBeenCalledWith({ setId: SET_ID, cardId: CARD_ID }),
    );
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("shows a recoverable error and resets the confirmation", async () => {
    mocks.deleteCard.mockResolvedValue({ ok: false, error: "Không tìm thấy flashcard." });
    const user = userEvent.setup();
    render(<DeleteCardButton setId={SET_ID} cardId={CARD_ID} />);
    await user.click(screen.getByRole("button", { name: /xóa thẻ/i }));
    await user.click(screen.getByRole("button", { name: /xóa vĩnh viễn/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Không tìm thấy flashcard.");
    expect(screen.queryByText(/xóa thẻ này/i)).not.toBeInTheDocument();
  });

  it("prevents duplicate submission while pending", async () => {
    let resolveAction: ((result: { ok: true }) => void) | undefined;
    mocks.deleteCard.mockReturnValue(
      new Promise((resolve) => {
        resolveAction = resolve;
      }),
    );
    const user = userEvent.setup();
    render(<DeleteCardButton setId={SET_ID} cardId={CARD_ID} />);
    await user.click(screen.getByRole("button", { name: /xóa thẻ/i }));
    const confirm = screen.getByRole("button", { name: /xóa vĩnh viễn/i });
    await user.click(confirm);
    expect(confirm).toBeDisabled();
    await user.click(confirm);
    expect(mocks.deleteCard).toHaveBeenCalledTimes(1);
    resolveAction?.({ ok: true });
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1));
  });
});
