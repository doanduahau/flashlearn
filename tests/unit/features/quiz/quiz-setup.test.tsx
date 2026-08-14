import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  getQuizEligibility: vi.fn().mockResolvedValue({ ok: true, total: 25 }),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, replace: vi.fn() }) }));
vi.mock("@/features/quiz/server/actions", () => ({
  getQuizEligibility: mocks.getQuizEligibility,
  startQuiz: vi.fn(),
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
    mocks.push.mockReset();
  });

  it("renders source selection and allows next step", async () => {
    const user = userEvent.setup();
    render(<QuizSetup sourcePage={SOURCE_PAGE} totalCards={25} />);

    expect(screen.getByRole("heading", { name: "Chọn một hoặc nhiều nguồn" })).toBeInTheDocument();

    await waitFor(() => expect(mocks.getQuizEligibility).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: "Bắt đầu kiểm tra" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Bắt đầu kiểm tra" }));
    expect(mocks.push).toHaveBeenCalledWith("/quiz/mode?all=1");
  });
});
