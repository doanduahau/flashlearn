import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { submitQuizAnswer } = vi.hoisted(() => ({ submitQuizAnswer: vi.fn() }));
vi.mock("@/features/quiz/server/actions", () => ({ submitQuizAnswer }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

import { QuizSession } from "@/features/quiz/components/quiz-session";

const first = {
  id: "11111111-1111-1111-1111-111111111111",
  position: 0,
  prompt: "First question",
  choices: ["One", "Two"],
};
const second = {
  id: "22222222-2222-2222-2222-222222222222",
  position: 1,
  prompt: "Second question",
  choices: ["Again one", "Again two"],
};

describe("QuizSession", () => {
  beforeEach(() => {
    submitQuizAnswer.mockReset();
    submitQuizAnswer.mockResolvedValue({ ok: true, correct: true, completed: false });
  });
  it("clears transient answer state when the current question changes", async () => {
    const user = userEvent.setup();
    const view = render(
      <QuizSession key={first.id} sessionId="session" total={2} question={first} />,
    );
    await user.click(screen.getByRole("radio", { name: "One" }));
    await user.click(screen.getByRole("button", { name: "Xác nhận đáp án" }));
    expect(await screen.findByText("Chính xác.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Câu tiếp theo" })).toBeInTheDocument();
    view.rerender(<QuizSession key={second.id} sessionId="session" total={2} question={second} />);
    expect(screen.getByRole("heading", { name: "Second question" })).toHaveFocus();
    expect(
      screen.getAllByRole("radio").every((radio) => !(radio as HTMLInputElement).checked),
    ).toBe(true);
    expect(
      screen.getAllByRole("radio").every((radio) => !(radio as HTMLInputElement).disabled),
    ).toBe(true);
    expect(screen.queryByText("Chính xác.")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Câu tiếp theo" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Again one" }));
    await user.click(screen.getByRole("button", { name: "Xác nhận đáp án" }));
    expect(submitQuizAnswer).toHaveBeenLastCalledWith({
      questionId: second.id,
      selectedChoiceIndex: 0,
    });
  });
});
