import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  updateCard: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/features/flashcard-sets/server/actions", () => ({ updateCard: mocks.updateCard }));

import { EditCardForm } from "@/features/flashcard-sets/components/edit-card-form";

const SET_ID = "11111111-1111-4111-8111-111111111111";
const CARD_ID = "22222222-2222-4222-8222-222222222222";

describe("EditCardForm", () => {
  beforeEach(() => {
    mocks.updateCard.mockReset();
    mocks.refresh.mockReset();
    mocks.updateCard.mockResolvedValue({ ok: true });
  });

  it("renders an edit trigger", () => {
    render(
      <EditCardForm setId={SET_ID} cardId={CARD_ID} initialFront="cũ" initialBack="back cũ" />,
    );
    expect(screen.getByRole("button", { name: /sửa/i })).toBeInTheDocument();
  });

  it("opens prefilled with the current card values", async () => {
    const user = userEvent.setup();
    render(
      <EditCardForm setId={SET_ID} cardId={CARD_ID} initialFront="cũ" initialBack="back cũ" />,
    );
    await user.click(screen.getByRole("button", { name: /sửa/i }));
    expect(screen.getByLabelText(/mặt trước/i)).toHaveValue("cũ");
    expect(screen.getByLabelText(/mặt sau/i)).toHaveValue("back cũ");
  });

  it("submits changes and closes the form on success", async () => {
    const user = userEvent.setup();
    render(
      <EditCardForm setId={SET_ID} cardId={CARD_ID} initialFront="cũ" initialBack="back cũ" />,
    );
    await user.click(screen.getByRole("button", { name: /sửa/i }));
    const front = screen.getByLabelText(/mặt trước/i);
    await user.clear(front);
    await user.type(front, "mới");
    await user.click(screen.getByRole("button", { name: /lưu/i }));
    await waitFor(() =>
      expect(mocks.updateCard).toHaveBeenCalledWith({
        setId: SET_ID,
        cardId: CARD_ID,
        front: "mới",
        back: "back cũ",
      }),
    );
    expect(mocks.refresh).toHaveBeenCalled();
    expect(screen.queryByLabelText(/mặt trước/i)).not.toBeInTheDocument();
  });

  it("keeps the form open with values after a recoverable error", async () => {
    mocks.updateCard.mockResolvedValue({ ok: false, error: "Không tìm thấy flashcard." });
    const user = userEvent.setup();
    render(
      <EditCardForm setId={SET_ID} cardId={CARD_ID} initialFront="cũ" initialBack="back cũ" />,
    );
    await user.click(screen.getByRole("button", { name: /sửa/i }));
    const front = screen.getByLabelText(/mặt trước/i);
    await user.clear(front);
    await user.type(front, "chưa lưu");
    await user.click(screen.getByRole("button", { name: /lưu/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Không tìm thấy flashcard.");
    expect(screen.getByLabelText(/mặt trước/i)).toHaveValue("chưa lưu");
    expect(screen.getByLabelText(/mặt sau/i)).toHaveValue("back cũ");
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("prevents duplicate submission while pending", async () => {
    let resolveAction: ((result: { ok: true }) => void) | undefined;
    mocks.updateCard.mockReturnValue(
      new Promise((resolve) => {
        resolveAction = resolve;
      }),
    );
    const user = userEvent.setup();
    render(
      <EditCardForm setId={SET_ID} cardId={CARD_ID} initialFront="cũ" initialBack="back cũ" />,
    );
    await user.click(screen.getByRole("button", { name: /sửa/i }));
    const save = screen.getByRole("button", { name: /lưu/i });
    await user.click(save);
    expect(save).toBeDisabled();
    await user.click(save);
    expect(mocks.updateCard).toHaveBeenCalledTimes(1);
    resolveAction?.({ ok: true });
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1));
  });

  it("cancels and resets the form", async () => {
    const user = userEvent.setup();
    render(
      <EditCardForm setId={SET_ID} cardId={CARD_ID} initialFront="cũ" initialBack="back cũ" />,
    );
    await user.click(screen.getByRole("button", { name: /sửa/i }));
    const front = screen.getByLabelText(/mặt trước/i);
    await user.clear(front);
    await user.type(front, "nháp");
    await user.click(screen.getByRole("button", { name: /hủy/i }));
    expect(screen.queryByLabelText(/mặt trước/i)).not.toBeInTheDocument();
    expect(mocks.updateCard).not.toHaveBeenCalled();
  });
});
