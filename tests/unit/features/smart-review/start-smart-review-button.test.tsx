import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  startSmartReview: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/features/smart-review/server/actions", () => ({
  startSmartReview: mocks.startSmartReview,
}));

import { StartSmartReviewButton } from "@/features/smart-review/components/start-smart-review-button";

describe("StartSmartReviewButton", () => {
  beforeEach(() => {
    mocks.push.mockReset();
    mocks.startSmartReview.mockReset();
  });

  it("starts the server-selected session and opens the existing quiz route", async () => {
    mocks.startSmartReview.mockResolvedValue({ ok: true, sessionId: "session-1" });
    const user = userEvent.setup();
    render(<StartSmartReviewButton />);

    await user.click(screen.getByRole("button", { name: "Ôn ngay" }));

    await waitFor(() => expect(mocks.startSmartReview).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/quiz/session-1"));
  });

  it("prevents a normal double tap from starting duplicate sessions", async () => {
    let resolveStart: ((value: { ok: true; sessionId: string }) => void) | undefined;
    mocks.startSmartReview.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveStart = resolve;
        }),
    );
    const user = userEvent.setup();
    render(<StartSmartReviewButton />);

    await user.dblClick(screen.getByRole("button", { name: "Ôn ngay" }));
    expect(mocks.startSmartReview).toHaveBeenCalledTimes(1);

    resolveStart?.({ ok: true, sessionId: "session-2" });
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/quiz/session-2"));
  });

  it("keeps the dashboard lightweight when the fresh snapshot has no candidates", async () => {
    mocks.startSmartReview.mockResolvedValue({
      ok: false,
      empty: true,
      error: "Không còn thẻ cần ôn.",
    });
    const user = userEvent.setup();
    render(<StartSmartReviewButton />);

    await user.click(screen.getByRole("button", { name: "Ôn ngay" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Không còn thẻ cần ôn.");
    expect(mocks.push).not.toHaveBeenCalled();
  });
});
