import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  startTypingSession: vi.fn(),
  submitTypingAttempt: vi.fn(),
  retryTypingSave: vi.fn(),
  updateCardCollections: vi.fn(),
  recordDailyActivity: vi.fn(),
  router: { push: vi.fn(), back: vi.fn(), refresh: vi.fn() },
}));

vi.mock("@/features/typing/server/actions", () => ({
  startTypingSession: mocks.startTypingSession,
  submitTypingAttempt: mocks.submitTypingAttempt,
  retryTypingSave: mocks.retryTypingSave,
}));
vi.mock("@/features/learning-modes/server/record-activity", () => ({
  recordDailyActivity: mocks.recordDailyActivity,
}));
vi.mock("@/features/practice-coverage/server/actions", () => ({
  completeLearningCoverageSession: vi.fn(),
}));
vi.mock("@/features/special-collections/server/actions", () => ({
  updateCardCollections: mocks.updateCardCollections,
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("next/navigation", () => ({ useRouter: () => mocks.router }));

import { TypingSession } from "@/features/typing/components/typing-session";
import type { StartedTypingSession } from "@/features/typing/types/typing-types";

const CARD_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const CARD_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

const session: StartedTypingSession = {
  coverageSessionId: "cccccccc-cccc-cccc-cccc-cccccccccccc",
  selectedCount: 2,
  eligibleCount: 2,
  cards: [
    { id: CARD_A, front: "Câu hỏi một?", back: "Đáp án một" },
    { id: CARD_B, front: "Câu hỏi hai?", back: "Đáp án hai" },
  ],
};

async function renderSession() {
  render(
    <TypingSession
      sessionHref="/typing/session?all=1&count=2"
      questionCount={2}
      exitHref="/quiz/mode?all=1"
      mascotLevel={1}
    />,
  );
  await waitFor(() => expect(screen.getByText("Câu hỏi một?")).toBeInTheDocument());
}

beforeEach(() => {
  mocks.startTypingSession.mockReset();
  mocks.submitTypingAttempt.mockReset();
  mocks.retryTypingSave.mockReset();
  mocks.updateCardCollections.mockReset();
  mocks.recordDailyActivity.mockReset();
  mocks.updateCardCollections.mockResolvedValue({ ok: true });
  mocks.startTypingSession.mockResolvedValue({ ok: true, session });
  mocks.recordDailyActivity.mockResolvedValue({ ok: true });
});

describe("TypingSession", () => {
  it("renders the question, an answer input and previous/next navigation", async () => {
    await renderSession();

    expect(screen.getByText("Câu 1 / 2")).toBeInTheDocument();
    expect(screen.getByLabelText("Đáp án cho câu 1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Câu sau" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Câu trước" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Nộp bài" })).toBeInTheDocument();
  });

  it("moves between questions and preserves typed answers", async () => {
    await renderSession();

    fireEvent.change(screen.getByLabelText("Đáp án cho câu 1"), {
      target: { value: "Đáp án một" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Câu sau" }));

    expect(screen.getByText("Câu 2 / 2")).toBeInTheDocument();
    expect(screen.getByLabelText("Đáp án cho câu 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Câu trước" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Câu trước" }));
    expect(screen.getByLabelText("Đáp án cho câu 1")).toHaveValue("Đáp án một");
  });

  it("warns about unanswered questions before submitting", async () => {
    await renderSession();

    fireEvent.click(screen.getByRole("button", { name: "Nộp bài" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Còn 2 câu chưa trả lời");
    expect(mocks.submitTypingAttempt).not.toHaveBeenCalled();
  });

  it("submits all answers and shows the result screen", async () => {
    mocks.submitTypingAttempt.mockResolvedValue({
      ok: true,
      saveError: null,
      result: {
        correctCount: 1,
        totalCount: 2,
        collections: [{ id: "44444444-4444-4444-8444-444444444444", name: "Khó nhớ" }],
        membershipsByCard: {},
        questions: [
          {
            flashcardId: CARD_A,
            setId: "22222222-2222-4222-8222-222222222222",
            front: "Câu hỏi một?",
            back: "Đáp án một",
            userAnswer: "Đáp án một",
            isCorrect: true,
          },
          {
            flashcardId: CARD_B,
            setId: "22222222-2222-4222-8222-222222222222",
            front: "Câu hỏi hai?",
            back: "Đáp án hai",
            userAnswer: "sai rồi",
            isCorrect: false,
          },
        ],
      },
    });
    await renderSession();

    fireEvent.change(screen.getByLabelText("Đáp án cho câu 1"), {
      target: { value: "Đáp án một" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Câu sau" }));
    fireEvent.change(screen.getByLabelText("Đáp án cho câu 2"), {
      target: { value: "sai rồi" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Nộp bài" }));
    });

    expect(screen.getByText("Kết quả kiểm tra")).toBeInTheDocument();
    expect(screen.getByText("1/2 đúng (50%)")).toBeInTheDocument();
    expect(screen.getAllByText("Đáp án của bạn:")).toHaveLength(2);
    expect(screen.getAllByText("Đáp án đúng:")).toHaveLength(2);
    expect(screen.getByText("sai rồi")).toBeInTheDocument();
    expect(screen.getByText("Đáp án hai")).toBeInTheDocument();
    expect(mocks.submitTypingAttempt).toHaveBeenCalledTimes(1);
  });

  it("shows a collection control below the wrong answer label", async () => {
    mocks.submitTypingAttempt.mockResolvedValue({
      ok: true,
      saveError: null,
      result: {
        correctCount: 1,
        totalCount: 2,
        collections: [{ id: "44444444-4444-4444-8444-444444444444", name: "Khó nhớ" }],
        membershipsByCard: {},
        questions: [
          {
            flashcardId: CARD_A,
            setId: "22222222-2222-4222-8222-222222222222",
            front: "Câu hỏi một?",
            back: "Đáp án một",
            userAnswer: "Đáp án một",
            isCorrect: true,
          },
          {
            flashcardId: CARD_B,
            setId: "22222222-2222-4222-8222-222222222222",
            front: "Câu hỏi hai?",
            back: "Đáp án hai",
            userAnswer: "sai rồi",
            isCorrect: false,
          },
        ],
      },
    });
    await renderSession();

    fireEvent.change(screen.getByLabelText("Đáp án cho câu 1"), {
      target: { value: "Đáp án một" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Câu sau" }));
    fireEvent.change(screen.getByLabelText("Đáp án cho câu 2"), {
      target: { value: "sai rồi" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Nộp bài" }));
    });

    // Only the wrong question (index 2) shows the "Thêm vào bộ đặc biệt" trigger.
    const triggers = screen.getAllByRole("button", { name: "Thêm vào bộ đặc biệt" });
    expect(triggers).toHaveLength(1);
    await act(async () => {
      fireEvent.click(triggers[0]!);
    });
    expect(screen.getByRole("checkbox", { name: "Khó nhớ" })).toBeInTheDocument();
  });

  it("replays the same configuration from the result screen", async () => {
    mocks.submitTypingAttempt.mockResolvedValue({
      ok: true,
      saveError: null,
      result: {
        correctCount: 2,
        totalCount: 2,
        collections: [],
        membershipsByCard: {},
        questions: [
          {
            flashcardId: CARD_A,
            setId: "22222222-2222-4222-8222-222222222222",
            front: "Câu hỏi một?",
            back: "Đáp án một",
            userAnswer: "Đáp án một",
            isCorrect: true,
          },
          {
            flashcardId: CARD_B,
            setId: "22222222-2222-4222-8222-222222222222",
            front: "Câu hỏi hai?",
            back: "Đáp án hai",
            userAnswer: "Đáp án hai",
            isCorrect: true,
          },
        ],
      },
    });
    await renderSession();

    fireEvent.change(screen.getByLabelText("Đáp án cho câu 1"), {
      target: { value: "Đáp án một" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Câu sau" }));
    fireEvent.change(screen.getByLabelText("Đáp án cho câu 2"), {
      target: { value: "Đáp án hai" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Nộp bài" }));
    });
    expect(screen.getByText("2/2 đúng (100%)")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Chơi lại" }));
    });
    expect(screen.getByText("Câu 1 / 2")).toBeInTheDocument();
  });
});
