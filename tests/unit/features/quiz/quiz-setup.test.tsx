import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getQuizEligibility: vi.fn(),
  push: vi.fn(),
  startQuiz: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, replace: vi.fn() }) }));
vi.mock("@/features/quiz/server/actions", () => ({
  getQuizEligibility: mocks.getQuizEligibility,
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

function eligibility(uncovered: number, total = 25, wrong = 0) {
  mocks.getQuizEligibility.mockResolvedValue({ ok: true, total, uncovered, wrong });
}

describe("QuizSetup", () => {
  beforeEach(() => {
    mocks.getQuizEligibility.mockReset();
    mocks.startQuiz.mockReset();
    eligibility(25);
  });

  it("shows exactly Chưa làm / Câu sai / Ngẫu nhiên and no Cân bằng or old labels", () => {
    render(<QuizSetup sourcePage={SOURCE_PAGE} totalCards={25} />);

    expect(screen.getByRole("button", { name: "Chưa làm" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Câu sai" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ngẫu nhiên" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cân bằng" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Chưa" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sai" })).not.toBeInTheDocument();
  });

  it("offers fixed counts below N plus Tất cả N", async () => {
    render(<QuizSetup sourcePage={SOURCE_PAGE} totalCards={25} />);

    await waitFor(() => expect(mocks.getQuizEligibility).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: "10" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "20" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tất cả 25" })).toBeInTheDocument();
    // Fixed counts >= N are not shown at all.
    expect(screen.queryByRole("button", { name: "30" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "50" })).not.toBeInTheDocument();
  });

  it("renders the All source card and allows a sub-10 Tất cả N", async () => {
    eligibility(7, 7);
    render(<QuizSetup sourcePage={SOURCE_PAGE} totalCards={7} />);

    expect(screen.getByRole("radio", { name: "Tất cả 7 thẻ" })).toBeChecked();
    await waitFor(() => expect(mocks.getQuizEligibility).toHaveBeenCalled());
    // N=7 -> only "Tất cả 7", which is now startable.
    expect(screen.getByRole("button", { name: "Tất cả 7" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bắt đầu kiểm tra" })).toBeEnabled();
  });

  it("disables start and shows an empty state when the pool is zero", async () => {
    eligibility(0, 0);
    render(<QuizSetup sourcePage={SOURCE_PAGE} totalCards={0} />);

    await waitFor(() => expect(mocks.getQuizEligibility).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: "Bắt đầu kiểm tra" })).toBeDisabled();
    expect(screen.getByText("Chưa có thẻ chưa làm.")).toBeInTheDocument();
  });

  it("offers 10 + Tất cả 13 when N=13", async () => {
    eligibility(13, 13);
    render(<QuizSetup sourcePage={SOURCE_PAGE} totalCards={13} />);

    await waitFor(() => expect(mocks.getQuizEligibility).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: "10" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tất cả 13" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "20" })).not.toBeInTheDocument();
  });

  it("offers 10 + Tất cả 20 with no duplicate 20 when N=20", async () => {
    eligibility(20, 20);
    render(<QuizSetup sourcePage={SOURCE_PAGE} totalCards={20} />);

    await waitFor(() => expect(mocks.getQuizEligibility).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: "10" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tất cả 20" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "20" })).not.toBeInTheDocument();
  });

  it("offers 10 + 20 + Tất cả 27 when N=27", async () => {
    eligibility(27, 27);
    render(<QuizSetup sourcePage={SOURCE_PAGE} totalCards={27} />);

    await waitFor(() => expect(mocks.getQuizEligibility).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: "10" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "20" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tất cả 27" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "30" })).not.toBeInTheDocument();
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
    mocks.startQuiz.mockResolvedValue({ ok: true, sessionId: "quiz-1" });
    const user = userEvent.setup();
    render(<QuizSetup sourcePage={SOURCE_PAGE} totalCards={25} />);
    await waitFor(() => expect(mocks.getQuizEligibility).toHaveBeenCalled());

    await user.click(screen.getByRole("checkbox", { name: /Bộ lớn/ }));
    await waitFor(() =>
      expect(mocks.getQuizEligibility).toHaveBeenCalledWith({
        all: false,
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

  it("maps the Câu sai filter to the wrong-answers quiz mode", async () => {
    eligibility(0, 25, 25);
    mocks.startQuiz.mockResolvedValue({ ok: true, sessionId: "quiz-2" });
    const user = userEvent.setup();
    render(<QuizSetup sourcePage={SOURCE_PAGE} totalCards={25} />);
    await waitFor(() => expect(mocks.getQuizEligibility).toHaveBeenCalled());

    await user.click(screen.getByRole("button", { name: "Câu sai" }));
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
    await waitFor(() => expect(mocks.getQuizEligibility).toHaveBeenCalled());

    await user.click(screen.getByRole("button", { name: "Ngẫu nhiên" }));
    await user.click(screen.getByRole("button", { name: "Bắt đầu kiểm tra" }));
    await waitFor(() =>
      expect(mocks.startQuiz).toHaveBeenCalledWith(
        expect.objectContaining({ mode: "pure_random" }),
      ),
    );
  });
});
