import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

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
  it("offers only fixed feasible question counts and disables impossible counts", () => {
    render(<QuizSetup sourcePage={SOURCE_PAGE} totalCards={25} />);

    expect(screen.getByText("Có 25 thẻ hợp lệ trong phạm vi.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "10" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "20" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "30" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "50" })).toBeDisabled();
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
  });

  it("shows the all-card fallback and disables start below ten eligible cards", () => {
    render(<QuizSetup sourcePage={SOURCE_PAGE} totalCards={7} />);

    expect(screen.getByRole("button", { name: "Tất cả (7)" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Bắt đầu kiểm tra" })).toBeDisabled();
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
        }),
      ),
    );
  });

  it("offers a dynamic all-card count option that reflects the eligible count", async () => {
    mocks.startQuiz.mockResolvedValue({ ok: true, sessionId: "quiz-2" });
    const user = userEvent.setup();
    render(<QuizSetup sourcePage={SOURCE_PAGE} totalCards={25} />);

    const allOption = screen.getByRole("button", { name: "Tất cả (25)" });
    expect(allOption).toBeEnabled();
    expect(allOption).toHaveAttribute("aria-pressed", "false");
    await user.click(allOption);
    expect(allOption).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: "Bắt đầu kiểm tra" }));
    await waitFor(() =>
      expect(mocks.startQuiz).toHaveBeenCalledWith(expect.objectContaining({ questionCount: 25 })),
    );
  });

  it("reflects the server-computed count for selected sources in the all-count option", async () => {
    mocks.getQuizCardCount.mockResolvedValue({ ok: true, count: 13 });
    const user = userEvent.setup();
    render(<QuizSetup sourcePage={SOURCE_PAGE} totalCards={25} />);

    await user.click(screen.getByRole("checkbox", { name: /Bộ lớn/ }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Tất cả (13)" })).toBeEnabled());
    expect(screen.queryByRole("button", { name: "Tất cả (25)" })).not.toBeInTheDocument();
  });

  it("does not duplicate an existing fixed count option", () => {
    render(<QuizSetup sourcePage={SOURCE_PAGE} totalCards={20} />);

    expect(screen.queryByRole("button", { name: "Tất cả (20)" })).not.toBeInTheDocument();
  });
});
