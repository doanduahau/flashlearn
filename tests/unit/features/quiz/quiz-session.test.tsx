import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { submitQuizAnswer, router } = vi.hoisted(() => ({
  submitQuizAnswer: vi.fn(),
  router: { push: vi.fn(), refresh: vi.fn() },
}));

vi.mock("@/features/quiz/server/actions", () => ({ submitQuizAnswer }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

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
    router.push.mockReset();
    router.refresh.mockReset();
  });

  it("advances automatically after a correct answer", async () => {
    submitQuizAnswer.mockResolvedValue({ ok: true, correct: true, completed: false });
    const user = userEvent.setup();
    render(<QuizSession sessionId="session" total={2} question={first} />);

    await user.click(screen.getByRole("radio", { name: "One" }));
    await user.click(screen.getByRole("button", { name: "Xác nhận đáp án" }));

    expect(await screen.findByText("Chính xác.")).toHaveFocus();
    await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1), { timeout: 2000 });
    expect(router.push).not.toHaveBeenCalled();
  });

  it("keeps a wrong answer visible until the learner explicitly advances", async () => {
    submitQuizAnswer.mockResolvedValue({ ok: true, correct: false, completed: false });
    const user = userEvent.setup();
    render(<QuizSession sessionId="session" total={2} question={first} />);

    await user.click(screen.getByRole("radio", { name: "One" }));
    await user.click(screen.getByRole("button", { name: "Xác nhận đáp án" }));

    expect(await screen.findByText("Chưa chính xác.")).toHaveFocus();
    expect(screen.getByRole("button", { name: "Câu tiếp theo" })).toBeInTheDocument();
    expect(screen.getAllByRole("radio").every((radio) => radio.hasAttribute("disabled"))).toBe(
      true,
    );
    expect(router.refresh).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Câu tiếp theo" }));
    expect(router.refresh).toHaveBeenCalledTimes(1);
    expect(router.push).not.toHaveBeenCalled();
  });

  it("renders the next question fresh after advancing", async () => {
    submitQuizAnswer.mockResolvedValue({ ok: true, correct: false, completed: false });
    const user = userEvent.setup();
    const view = render(
      <QuizSession key={first.id} sessionId="session" total={2} question={first} />,
    );

    await user.click(screen.getByRole("radio", { name: "One" }));
    await user.click(screen.getByRole("button", { name: "Xác nhận đáp án" }));
    await user.click(screen.getByRole("button", { name: "Câu tiếp theo" }));

    view.rerender(<QuizSession key={second.id} sessionId="session" total={2} question={second} />);
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Second question" })).toHaveFocus(),
    );
    expect(
      screen.getAllByRole("radio").every((radio) => !(radio as HTMLInputElement).checked),
    ).toBe(true);
    expect(screen.getAllByRole("radio").every((radio) => !radio.hasAttribute("disabled"))).toBe(
      true,
    );
    expect(screen.queryByText("Chưa chính xác.")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Câu tiếp theo" })).not.toBeInTheDocument();
  });

  it("does not duplicate a pending submission", async () => {
    const pendingAnswer: {
      resolve?: (result: { ok: true; correct: boolean; completed: boolean }) => void;
    } = {};
    submitQuizAnswer.mockImplementation(
      () =>
        new Promise((resolve) => {
          pendingAnswer.resolve = resolve;
        }),
    );
    const user = userEvent.setup();
    render(<QuizSession sessionId="session" total={2} question={first} />);

    await user.click(screen.getByRole("radio", { name: "One" }));
    await user.dblClick(screen.getByRole("button", { name: "Xác nhận đáp án" }));

    expect(submitQuizAnswer).toHaveBeenCalledTimes(1);
    if (!pendingAnswer.resolve) throw new Error("Submission promise was not created.");
    pendingAnswer.resolve({ ok: true, correct: true, completed: false });
    expect(await screen.findByText("Chính xác.")).toBeInTheDocument();
  });

  it("auto-opens results after the final answer", async () => {
    submitQuizAnswer.mockResolvedValue({ ok: true, correct: false, completed: true });
    const user = userEvent.setup();
    render(<QuizSession sessionId="session" total={1} question={first} />);

    await user.click(screen.getByRole("radio", { name: "Two" }));
    await user.click(screen.getByRole("button", { name: "Xác nhận đáp án" }));

    expect(await screen.findByText("Chưa chính xác.")).toBeInTheDocument();
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/quiz/session/result"), {
      timeout: 2000,
    });
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("does not pollute the quiz correctness UI with mastery colors", async () => {
    render(<QuizSession sessionId="session" total={2} question={first} />);
    expect(
      screen.queryByRole("img", { name: /Chưa học|Cần ôn|Đang học|Đã nhớ/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Chưa học|Cần ôn|Đang học|Đã nhớ/)).not.toBeInTheDocument();
  });
});
