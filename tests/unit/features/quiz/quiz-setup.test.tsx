import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getQuizCardCount: vi.fn(),
  push: vi.fn(),
  startQuiz: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, replace: vi.fn() }) }));
vi.mock("@/features/quiz/server/actions", () => ({
  getQuizCardCount: mocks.getQuizCardCount,
  startQuiz: mocks.startQuiz,
}));

import { QuizSetup } from "@/features/quiz/components/quiz-setup";
import type { SourcePage } from "@/features/source-selection/types/source-types";

const SOURCE_PAGE: SourcePage = {
  sources: [
    {
      id: "11111111-1111-4111-8111-111111111111",
      kind: "regular",
      name: "Bộ lớn",
      cardCount: 20,
    },
  ],
  page: 1,
  totalPages: 1,
  query: "",
  type: "all",
};

describe("QuizSetup", () => {
  beforeEach(() => {
    mocks.getQuizCardCount.mockReset();
    mocks.startQuiz.mockReset();
  });

  it("shows exactly the shared three filters and no Cân bằng", () => {
    render(<QuizSetup sourcePage={SOURCE_PAGE} totalCards={25} />);

    expect(screen.getByRole("button", { name: "Chưa" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sai" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ngẫu nhiên" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cân bằng" })).not.toBeInTheDocument();
  });

  it("offers only fixed feasible question counts and disables impossible counts", () => {
    render(<QuizSetup sourcePage={SOURCE_PAGE} totalCards={25} />);

    expect(screen.getByText("25 thẻ hợp lệ")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "10" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "20" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "30" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "50" })).toBeDisabled();
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
  });

  it("renders the All source card with the total count and disables start below ten", () => {
    render(<QuizSetup sourcePage={SOURCE_PAGE} totalCards={7} />);

    expect(screen.getByRole("radio", { name: "Tất cả 7 thẻ" })).toBeChecked();
    expect(screen.getByRole("button", { name: "Bắt đầu kiểm tra" })).toBeDisabled();
  });

  it("renders the All source card with the eligible count by default", () => {
    render(<QuizSetup sourcePage={SOURCE_PAGE} totalCards={25} />);
    expect(screen.getByRole("radio", { name: "Tất cả 25 thẻ" })).toBeChecked();
  });

  it("orders mode and count above the source list", () => {
    render(<QuizSetup sourcePage={SOURCE_PAGE} totalCards={25} />);

    const source = screen.getByRole("heading", { name: "Chọn một hoặc nhiều nguồn" });
    for (const label of ["Chế độ", "Số câu"]) {
      const control = screen.getByText(label);
      expect(control.compareDocumentPosition(source) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      );
    }
  });

  it("uses an exact server count for selected sources before starting", async () => {
    mocks.getQuizCardCount.mockResolvedValue({ ok: true, count: 20 });
    mocks.startQuiz.mockResolvedValue({ ok: true, sessionId: "quiz-1" });
    const user = userEvent.setup();
    render(<QuizSetup sourcePage={SOURCE_PAGE} totalCards={25} />);

    await user.click(screen.getByRole("checkbox", { name: /Bộ lớn/ }));
    await waitFor(() =>
      expect(mocks.getQuizCardCount).toHaveBeenCalledWith({
        setIds: ["11111111-1111-4111-8111-111111111111"],
        collectionIds: [],
      }),
    );
    await user.click(screen.getByRole("button", { name: "Bắt đầu kiểm tra" }));
    await waitFor(() =>
      expect(mocks.startQuiz).toHaveBeenCalledWith(
        expect.objectContaining({
          all: false,
          setIds: ["11111111-1111-4111-8111-111111111111"],
          questionCount: 10,
          mode: "never_tested",
        }),
      ),
    );
  });

  it("offers a dynamic all-card count option when eligible is not a fixed count", () => {
    render(<QuizSetup sourcePage={SOURCE_PAGE} totalCards={24} />);

    expect(screen.getByRole("button", { name: "Tất cả (24)" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Tất cả (24)" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("does not duplicate an existing fixed count option", () => {
    render(<QuizSetup sourcePage={SOURCE_PAGE} totalCards={20} />);
    expect(screen.queryByRole("button", { name: "Tất cả (20)" })).not.toBeInTheDocument();
  });

  it("maps the Sai filter to the wrong-answers quiz mode", async () => {
    mocks.startQuiz.mockResolvedValue({ ok: true, sessionId: "quiz-2" });
    const user = userEvent.setup();
    render(<QuizSetup sourcePage={SOURCE_PAGE} totalCards={25} />);

    await user.click(screen.getByRole("button", { name: "Sai" }));
    await user.click(screen.getByRole("button", { name: "Bắt đầu kiểm tra" }));
    await waitFor(() =>
      expect(mocks.startQuiz).toHaveBeenCalledWith(
        expect.objectContaining({ mode: "wrong_answers" }),
      ),
    );
  });

  it("maps the Ngẫu nhiên filter to the pure-random quiz mode", async () => {
    mocks.startQuiz.mockResolvedValue({ ok: true, sessionId: "quiz-3" });
    const user = userEvent.setup();
    render(<QuizSetup sourcePage={SOURCE_PAGE} totalCards={25} />);

    await user.click(screen.getByRole("button", { name: "Ngẫu nhiên" }));
    await user.click(screen.getByRole("button", { name: "Bắt đầu kiểm tra" }));
    await waitFor(() =>
      expect(mocks.startQuiz).toHaveBeenCalledWith(
        expect.objectContaining({ mode: "pure_random" }),
      ),
    );
  });
});
