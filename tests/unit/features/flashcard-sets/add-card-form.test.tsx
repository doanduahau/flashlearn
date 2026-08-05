import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  addCard: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/features/flashcard-sets/server/actions", () => ({ addCard: mocks.addCard }));

import { AddCardForm } from "@/features/flashcard-sets/components/add-card-form";

const SET_ID = "11111111-1111-4111-8111-111111111111";

describe("AddCardForm", () => {
  beforeEach(() => {
    mocks.addCard.mockReset();
    mocks.refresh.mockReset();
    mocks.addCard.mockResolvedValue({ ok: true });
  });

  it("renders accessible front and back fields", () => {
    render(<AddCardForm setId={SET_ID} />);
    expect(screen.getByLabelText(/mặt trước/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/mặt sau/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /thêm thẻ/i })).toBeInTheDocument();
  });

  it("submits the card and clears the form on success", async () => {
    const user = userEvent.setup();
    render(<AddCardForm setId={SET_ID} />);
    await user.type(screen.getByLabelText(/mặt trước/i), "  Xin chào  ");
    await user.type(screen.getByLabelText(/mặt sau/i), "Hello");
    await user.click(screen.getByRole("button", { name: /thêm thẻ/i }));
    await waitFor(() =>
      expect(mocks.addCard).toHaveBeenCalledWith({
        setId: SET_ID,
        front: "  Xin chào  ",
        back: "Hello",
      }),
    );
    expect(mocks.refresh).toHaveBeenCalled();
    await waitFor(() => expect(screen.getByLabelText(/mặt trước/i)).toHaveValue(""));
    expect(screen.getByLabelText(/mặt sau/i)).toHaveValue("");
  });

  it("keeps entered values after a recoverable server error", async () => {
    mocks.addCard.mockResolvedValue({ ok: false, error: "Không thể thêm flashcard." });
    const user = userEvent.setup();
    render(<AddCardForm setId={SET_ID} />);
    await user.type(screen.getByLabelText(/mặt trước/i), "Giữ lại");
    await user.type(screen.getByLabelText(/mặt sau/i), "Back");
    await user.click(screen.getByRole("button", { name: /thêm thẻ/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Không thể thêm flashcard.");
    expect(screen.getByLabelText(/mặt trước/i)).toHaveValue("Giữ lại");
    expect(screen.getByLabelText(/mặt sau/i)).toHaveValue("Back");
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("disables submit when fields are blank or whitespace-only", async () => {
    const user = userEvent.setup();
    render(<AddCardForm setId={SET_ID} />);
    const submit = screen.getByRole("button", { name: /thêm thẻ/i });
    expect(submit).toBeDisabled();
    await user.type(screen.getByLabelText(/mặt trước/i), "   ");
    await user.type(screen.getByLabelText(/mặt sau/i), "back");
    expect(submit).toBeDisabled();
    await user.type(screen.getByLabelText(/mặt trước/i), "front");
    expect(submit).toBeEnabled();
  });

  it("prevents duplicate submission while pending", async () => {
    let resolveAction: ((result: { ok: true }) => void) | undefined;
    mocks.addCard.mockReturnValue(
      new Promise((resolve) => {
        resolveAction = resolve;
      }),
    );
    const user = userEvent.setup();
    render(<AddCardForm setId={SET_ID} />);
    await user.type(screen.getByLabelText(/mặt trước/i), "front");
    await user.type(screen.getByLabelText(/mặt sau/i), "back");
    const submit = screen.getByRole("button", { name: /thêm thẻ/i });
    await user.click(submit);
    expect(submit).toBeDisabled();
    await user.click(submit);
    expect(mocks.addCard).toHaveBeenCalledTimes(1);
    resolveAction?.({ ok: true });
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1));
  });
});
