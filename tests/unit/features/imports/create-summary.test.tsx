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
      />,
    );

    expect(screen.getByText(/2 thẻ hợp lệ/)).toBeInTheDocument();
    expect(screen.getByText(/1 dòng trống được bỏ qua/)).toBeInTheDocument();
    expect(screen.getByText(/1 thẻ thiếu mặt trước hoặc mặt sau/)).toBeInTheDocument();
    expect(screen.getByText(/1 thẻ trùng được bỏ qua/)).toBeInTheDocument();
  });

  it("requires a set name before creating", async () => {
    const user = userEvent.setup();
    render(<CreateSummary sourceCards={[{ front: "A", back: "1" }]} />);

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
    render(<CreateSummary sourceCards={[{ front: "", back: "1" }]} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Không có thẻ hợp lệ");
    expect(screen.queryByRole("button", { name: /Tạo bộ flashcard/i })).not.toBeInTheDocument();
  });

  it("blocks creation when the limit is exceeded", () => {
    render(<CreateSummary sourceCards={[{ front: "A", back: "1" }]} limitExceeded />);

    expect(screen.getByText(/tối đa/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Tạo bộ flashcard/i })).not.toBeInTheDocument();
  });

  it("renders warnings from the source pipeline", () => {
    render(
      <CreateSummary
        sourceCards={[{ front: "A", back: "1" }]}
        warnings={["Một số nội dung chưa được phân tích."]}
      />,
    );

    expect(screen.getByText("Một số nội dung chưa được phân tích.")).toBeInTheDocument();
  });

  it("shows a server error when the import action fails", async () => {
    mocks.importFlashcards.mockResolvedValueOnce({ error: "Tên bộ đã tồn tại." });
    const user = userEvent.setup();
    render(<CreateSummary sourceCards={[{ front: "A", back: "1" }]} />);

    await user.type(screen.getByLabelText("Tên bộ"), "Trùng");
    await user.click(screen.getByRole("button", { name: /Tạo bộ flashcard/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Tên bộ đã tồn tại."));
    expect(mocks.push).not.toHaveBeenCalled();
  });
});
