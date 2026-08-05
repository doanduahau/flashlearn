import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  renameSet: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/features/flashcard-sets/server/actions", () => ({ renameSet: mocks.renameSet }));

import { RenameSetForm } from "@/features/flashcard-sets/components/rename-set-form";

const SET_ID = "11111111-1111-4111-8111-111111111111";

describe("RenameSetForm", () => {
  beforeEach(() => {
    mocks.renameSet.mockReset();
    mocks.refresh.mockReset();
    mocks.renameSet.mockResolvedValue({ ok: true });
  });

  it("renders a rename trigger with an accessible label", () => {
    render(<RenameSetForm setId={SET_ID} initialName="Set cũ" />);
    expect(screen.getByRole("button", { name: /đổi tên/i })).toBeInTheDocument();
  });

  it("opens the form prefilled with the current name", async () => {
    const user = userEvent.setup();
    render(<RenameSetForm setId={SET_ID} initialName="Set cũ" />);
    await user.click(screen.getByRole("button", { name: /đổi tên/i }));
    expect(screen.getByLabelText(/tên bộ/i)).toHaveValue("Set cũ");
    expect(screen.getByRole("button", { name: /lưu/i })).toBeInTheDocument();
  });

  it("submits the trimmed name and closes the form on success", async () => {
    const user = userEvent.setup();
    render(<RenameSetForm setId={SET_ID} initialName="Set cũ" />);
    await user.click(screen.getByRole("button", { name: /đổi tên/i }));
    const input = screen.getByLabelText(/tên bộ/i);
    await user.clear(input);
    await user.type(input, "  Set mới  ");
    await user.click(screen.getByRole("button", { name: /lưu/i }));
    await waitFor(() =>
      expect(mocks.renameSet).toHaveBeenCalledWith({ setId: SET_ID, name: "  Set mới  " }),
    );
    expect(mocks.refresh).toHaveBeenCalled();
    expect(screen.queryByLabelText(/tên bộ/i)).not.toBeInTheDocument();
  });

  it("keeps the form open with entered values after a recoverable error", async () => {
    mocks.renameSet.mockResolvedValue({ ok: false, error: "Không tìm thấy bộ flashcard." });
    const user = userEvent.setup();
    render(<RenameSetForm setId={SET_ID} initialName="Set cũ" />);
    await user.click(screen.getByRole("button", { name: /đổi tên/i }));
    const input = screen.getByLabelText(/tên bộ/i);
    await user.clear(input);
    await user.type(input, "Set giữ nguyên");
    await user.click(screen.getByRole("button", { name: /lưu/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Không tìm thấy bộ flashcard.");
    expect(screen.getByLabelText(/tên bộ/i)).toHaveValue("Set giữ nguyên");
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("prevents duplicate submission while pending", async () => {
    let resolveAction: ((result: { ok: true }) => void) | undefined;
    mocks.renameSet.mockReturnValue(
      new Promise((resolve) => {
        resolveAction = resolve;
      }),
    );
    const user = userEvent.setup();
    render(<RenameSetForm setId={SET_ID} initialName="Set cũ" />);
    await user.click(screen.getByRole("button", { name: /đổi tên/i }));
    const input = screen.getByLabelText(/tên bộ/i);
    await user.clear(input);
    await user.type(input, "Set mới");
    const save = screen.getByRole("button", { name: /lưu/i });
    await user.click(save);
    expect(save).toBeDisabled();
    await user.click(save);
    expect(mocks.renameSet).toHaveBeenCalledTimes(1);
    resolveAction?.({ ok: true });
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1));
  });

  it("disables save for a whitespace-only name", async () => {
    const user = userEvent.setup();
    render(<RenameSetForm setId={SET_ID} initialName="Set cũ" />);
    await user.click(screen.getByRole("button", { name: /đổi tên/i }));
    const input = screen.getByLabelText(/tên bộ/i);
    await user.clear(input);
    await user.type(input, "   ");
    expect(screen.getByRole("button", { name: /lưu/i })).toBeDisabled();
  });

  it("cancels and resets the form", async () => {
    const user = userEvent.setup();
    render(<RenameSetForm setId={SET_ID} initialName="Set cũ" />);
    await user.click(screen.getByRole("button", { name: /đổi tên/i }));
    await user.click(screen.getByRole("button", { name: /hủy/i }));
    expect(screen.queryByLabelText(/tên bộ/i)).not.toBeInTheDocument();
    expect(mocks.renameSet).not.toHaveBeenCalled();
  });
});
