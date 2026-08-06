import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  importFlashcards: vi.fn(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/features/imports/server/actions", () => ({
  importFlashcards: mocks.importFlashcards,
}));

import { ManualSetForm } from "@/features/flashcard-sets/components/manual-set-form";

const SET_ID = "11111111-1111-4111-8111-111111111111";

function frontFields() {
  return screen.getAllByLabelText(/^Mặt trước$/i);
}

function backFields() {
  return screen.getAllByLabelText(/^Mặt sau$/i);
}

describe("ManualSetForm", () => {
  beforeEach(() => {
    mocks.importFlashcards.mockReset();
    mocks.push.mockReset();
    mocks.importFlashcards.mockResolvedValue({ setId: SET_ID });
  });

  it("renders a full-screen sheet with a name field and one empty card row", () => {
    render(<ManualSetForm />);
    expect(screen.getByRole("dialog", { name: "Tạo bộ thủ công" })).toBeInTheDocument();
    expect(screen.getByLabelText("Tên bộ flashcard")).toBeInTheDocument();
    expect(frontFields()).toHaveLength(1);
    expect(backFields()).toHaveLength(1);
    expect(screen.getByRole("button", { name: /tạo bộ/i })).toBeInTheDocument();
  });

  it("creates a one-card set and navigates to it", async () => {
    const user = userEvent.setup();
    render(<ManualSetForm />);
    await user.type(screen.getByLabelText("Tên bộ flashcard"), "Bộ một thẻ");
    await user.type(frontFields()[0], "Xin chào");
    await user.type(backFields()[0], "Hello");
    await user.click(screen.getByRole("button", { name: /tạo bộ/i }));
    await waitFor(() =>
      expect(mocks.importFlashcards).toHaveBeenCalledWith({
        name: "Bộ một thẻ",
        cards: [{ front: "Xin chào", back: "Hello" }],
      }),
    );
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith(`/sets/${SET_ID}`));
  });

  it("creates a multi-card set with added rows", async () => {
    const user = userEvent.setup();
    render(<ManualSetForm />);
    await user.type(screen.getByLabelText("Tên bộ flashcard"), "Bộ nhiều thẻ");
    await user.type(frontFields()[0], "Một");
    await user.type(backFields()[0], "One");
    await user.click(screen.getByRole("button", { name: /thêm thẻ/i }));
    await user.click(screen.getByRole("button", { name: /thêm thẻ/i }));
    expect(frontFields()).toHaveLength(3);
    await user.type(frontFields()[1], "Hai");
    await user.type(backFields()[1], "Two");
    await user.type(frontFields()[2], "Ba");
    await user.type(backFields()[2], "Three");
    await user.click(screen.getByRole("button", { name: /tạo bộ/i }));
    await waitFor(() =>
      expect(mocks.importFlashcards).toHaveBeenCalledWith({
        name: "Bộ nhiều thẻ",
        cards: [
          { front: "Một", back: "One" },
          { front: "Hai", back: "Two" },
          { front: "Ba", back: "Three" },
        ],
      }),
    );
  });

  it("removes a row and keeps at least one row", async () => {
    const user = userEvent.setup();
    render(<ManualSetForm />);
    await user.click(screen.getByRole("button", { name: /thêm thẻ/i }));
    expect(frontFields()).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: /xóa thẻ 2/i }));
    expect(frontFields()).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: /xóa thẻ 1/i }));
    expect(frontFields()).toHaveLength(1);
  });

  it("shows inline field errors and focuses the first invalid field", async () => {
    const user = userEvent.setup();
    render(<ManualSetForm />);
    await user.click(screen.getByRole("button", { name: /tạo bộ/i }));
    expect(screen.getByText("Nhập tên bộ flashcard.")).toBeInTheDocument();
    expect(screen.getByText("Mặt trước không được để trống.")).toBeInTheDocument();
    expect(screen.getByText("Mặt sau không được để trống.")).toBeInTheDocument();
    expect(mocks.importFlashcards).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByLabelText("Tên bộ flashcard")),
    );
  });

  it("focuses the first invalid card field when the name is valid", async () => {
    const user = userEvent.setup();
    render(<ManualSetForm />);
    await user.type(screen.getByLabelText("Tên bộ flashcard"), "Bộ hợp lệ");
    await user.click(screen.getByRole("button", { name: /tạo bộ/i }));
    expect(screen.queryByText("Nhập tên bộ flashcard.")).not.toBeInTheDocument();
    expect(screen.getByText("Mặt trước không được để trống.")).toBeInTheDocument();
    await waitFor(() => expect(document.activeElement).toBe(frontFields()[0]));
  });

  it("clears a field error once the field is edited", async () => {
    const user = userEvent.setup();
    render(<ManualSetForm />);
    await user.click(screen.getByRole("button", { name: /tạo bộ/i }));
    expect(screen.getByText("Nhập tên bộ flashcard.")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Tên bộ flashcard"), "A");
    expect(screen.queryByText("Nhập tên bộ flashcard.")).not.toBeInTheDocument();
  });

  it("keeps the sheet open with values after a recoverable server error", async () => {
    mocks.importFlashcards.mockResolvedValue({ error: "Không thể import bộ flashcard." });
    const user = userEvent.setup();
    render(<ManualSetForm />);
    await user.type(screen.getByLabelText("Tên bộ flashcard"), "Bộ lỗi");
    await user.type(frontFields()[0], "Giữ lại");
    await user.type(backFields()[0], "Back giữ");
    await user.click(screen.getByRole("button", { name: /tạo bộ/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Không thể import bộ flashcard.");
    expect(screen.getByLabelText("Tên bộ flashcard")).toHaveValue("Bộ lỗi");
    expect(frontFields()[0]).toHaveValue("Giữ lại");
    expect(backFields()[0]).toHaveValue("Back giữ");
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("prevents duplicate submission while pending", async () => {
    let resolveImport: ((result: { setId: string }) => void) | undefined;
    mocks.importFlashcards.mockReturnValue(
      new Promise((resolve) => {
        resolveImport = resolve;
      }),
    );
    const user = userEvent.setup();
    render(<ManualSetForm />);
    await user.type(screen.getByLabelText("Tên bộ flashcard"), "Bộ chờ");
    await user.type(frontFields()[0], "Front");
    await user.type(backFields()[0], "Back");
    const submit = screen.getByRole("button", { name: /tạo bộ/i });
    await user.click(submit);
    expect(submit).toBeDisabled();
    await user.click(submit);
    expect(mocks.importFlashcards).toHaveBeenCalledTimes(1);
    resolveImport?.({ setId: SET_ID });
    await waitFor(() => expect(mocks.push).toHaveBeenCalledTimes(1));
  });

  it("navigates back without confirmation when nothing was entered", async () => {
    const user = userEvent.setup();
    render(<ManualSetForm />);
    await user.click(screen.getByRole("button", { name: /đóng/i }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/dashboard"));
  });

  it("confirms before discarding unsaved changes and stays on cancel", async () => {
    const user = userEvent.setup();
    render(<ManualSetForm />);
    await user.type(screen.getByLabelText("Tên bộ flashcard"), "Nhá");
    await user.click(screen.getByRole("button", { name: /đóng/i }));
    const confirm = screen.getByRole("alertdialog", { name: "Xác nhận hủy" });
    expect(confirm).toBeInTheDocument();
    expect(mocks.push).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /ở lại/i }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Tên bộ flashcard")).toHaveValue("Nhá");
  });

  it("discards unsaved changes when confirmed", async () => {
    const user = userEvent.setup();
    render(<ManualSetForm />);
    await user.type(frontFields()[0], "chưa lưu");
    await user.click(screen.getByRole("button", { name: /đóng/i }));
    await user.click(screen.getByRole("button", { name: /rời đi/i }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/dashboard"));
    expect(mocks.importFlashcards).not.toHaveBeenCalled();
  });

  it("renders a scrollable sheet body for a long list of rows", async () => {
    const user = userEvent.setup();
    render(<ManualSetForm />);
    for (let i = 0; i < 12; i += 1) {
      await user.click(screen.getByRole("button", { name: /thêm thẻ/i }));
    }
    const dialog = screen.getByRole("dialog", { name: "Tạo bộ thủ công" });
    expect(dialog.querySelector(".overflow-y-auto")).toBeInTheDocument();
    expect(frontFields()).toHaveLength(13);
    expect(screen.getByRole("button", { name: /tạo bộ/i })).toBeInTheDocument();
  });
});
