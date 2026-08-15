import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  importFlashcards: vi.fn(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/features/imports/server/actions", () => ({ importFlashcards: mocks.importFlashcards }));

import { CreateSummary } from "@/features/imports/components/create-summary";

const SET_ID = "11111111-1111-1111-1111-111111111111";

describe("CreateSummary", () => {
  beforeEach(() => {
    mocks.importFlashcards.mockReset();
    mocks.push.mockReset();
    mocks.importFlashcards.mockResolvedValue({ setId: SET_ID });
  });

  it("summarizes valid cards and reports skipped blank, partial, and duplicate rows", () => {
    render(
      <CreateSummary
        sourceCards={[
          { front: "A", back: "1" },
          { front: "B", back: "2" },
          { front: "", back: "" },
          { front: "C", back: "" },
          { front: "A", back: "1" },
        ]}
        mascotLevel={1}
      />,
    );

    expect(screen.getByText(/2 thẻ hợp lệ/)).toBeInTheDocument();
    expect(screen.getByText(/1 dòng trống được bỏ qua/)).toBeInTheDocument();
    expect(screen.getByText(/1 thẻ thiếu mặt trước hoặc mặt sau/)).toBeInTheDocument();
    expect(screen.getByText(/1 thẻ trùng được bỏ qua/)).toBeInTheDocument();
  });

  it("requires a set name before creating", async () => {
    const user = userEvent.setup();
    render(<CreateSummary sourceCards={[{ front: "A", back: "1" }]} mascotLevel={1} />);

    const createButton = screen.getByRole("button", { name: /Tạo bộ flashcard/i });
    expect(createButton).toBeDisabled();

    await user.type(screen.getByLabelText("Tên bộ"), "Bộ kiểm tra");
    expect(createButton).toBeEnabled();
  });

  it("creates the set with only the validated cards and redirects to the set page", async () => {
    const user = userEvent.setup();
    render(
      <CreateSummary
        sourceCards={[
          { front: "A", back: "1" },
          { front: "A", back: "1" },
          { front: "B", back: "" },
        ]}
        mascotLevel={1}
      />,
    );

    await user.type(screen.getByLabelText("Tên bộ"), "Bộ đã tạo");
    await user.click(screen.getByRole("button", { name: /Tạo bộ flashcard/i }));

    await waitFor(() =>
      expect(mocks.importFlashcards).toHaveBeenCalledWith({
        name: "Bộ đã tạo",
        cards: [{ front: "A", back: "1" }],
      }),
    );
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith(`/sets/${SET_ID}`));
  });

  it("shows a clear error when no valid cards remain and disables creation", () => {
    render(<CreateSummary sourceCards={[{ front: "", back: "1" }]} mascotLevel={1} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Không có thẻ hợp lệ");
    expect(screen.queryByRole("button", { name: /Tạo bộ flashcard/i })).not.toBeInTheDocument();
  });

  it("blocks creation when the limit is exceeded", () => {
    render(
      <CreateSummary sourceCards={[{ front: "A", back: "1" }]} limitExceeded mascotLevel={1} />,
    );

    expect(screen.getByText(/tối đa/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Tạo bộ flashcard/i })).not.toBeInTheDocument();
  });

  it("renders warnings from the source pipeline", () => {
    render(
      <CreateSummary
        sourceCards={[{ front: "A", back: "1" }]}
        warnings={["Một số nội dung chưa được phân tích."]}
        mascotLevel={1}
      />,
    );

    expect(screen.getByText("Một số nội dung chưa được phân tích.")).toBeInTheDocument();
  });

  it("shows a server error when the import action fails", async () => {
    mocks.importFlashcards.mockResolvedValueOnce({ error: "Tên bộ đã tồn tại." });
    const user = userEvent.setup();
    render(<CreateSummary sourceCards={[{ front: "A", back: "1" }]} mascotLevel={1} />);

    await user.type(screen.getByLabelText("Tên bộ"), "Trùng");
    await user.click(screen.getByRole("button", { name: /Tạo bộ flashcard/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Tên bộ đã tồn tại."));
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("displays preview cards in editable inputs", () => {
    render(<CreateSummary sourceCards={[{ front: "FrontA", back: "Back1" }]} mascotLevel={1} />);
    expect(screen.getByDisplayValue("FrontA")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Back1")).toBeInTheDocument();
  });

  it("updates validation when a card is edited to be blank", async () => {
    const user = userEvent.setup();
    render(
      <CreateSummary
        sourceCards={[
          { front: "FrontA", back: "Back1" },
          { front: "FrontB", back: "Back2" },
        ]}
        mascotLevel={1}
      />,
    );

    expect(screen.getByText(/2 thẻ hợp lệ/)).toBeInTheDocument();
    const frontInput = screen.getByDisplayValue("FrontA");
    await user.clear(frontInput);

    expect(screen.getByText(/1 thẻ hợp lệ/)).toBeInTheDocument();
    expect(screen.getByText(/1 thẻ thiếu mặt trước/)).toBeInTheDocument();
  });

  it("updates validation when a card is deleted", async () => {
    const user = userEvent.setup();
    render(
      <CreateSummary
        sourceCards={[
          { front: "FrontA", back: "Back1" },
          { front: "FrontB", back: "Back2" },
        ]}
        mascotLevel={1}
      />,
    );

    expect(screen.getByText(/2 thẻ hợp lệ/)).toBeInTheDocument();
    const deleteButtons = screen.getAllByRole("button", { name: /^Xóa thẻ/ });
    await user.click(deleteButtons[0]!);

    expect(screen.getByText(/1 thẻ hợp lệ/)).toBeInTheDocument();
    expect(screen.queryByDisplayValue("FrontA")).not.toBeInTheDocument();
  });

  it("shows a notice when there are more than 100 cards", () => {
    const manyCards = Array.from({ length: 105 }, (_, i) => ({ front: `F${i}`, back: `B${i}` }));
    render(<CreateSummary sourceCards={manyCards} mascotLevel={1} />);

    expect(screen.getByText(/105 thẻ hợp lệ/)).toBeInTheDocument();
    expect(screen.getByText(/\.\.\. và 5 thẻ khác/)).toBeInTheDocument();
  });
});
