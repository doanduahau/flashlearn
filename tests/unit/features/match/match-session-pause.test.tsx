import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { startMatchCoverageSession, completeLearningCoverageSession, router } = vi.hoisted(() => ({
  startMatchCoverageSession: vi.fn(),
  completeLearningCoverageSession: vi.fn(),
  router: { push: vi.fn(), back: vi.fn(), refresh: vi.fn() },
}));

vi.mock("@/features/match/server/actions", () => ({ startMatchCoverageSession }));
vi.mock("@/features/practice-coverage/server/actions", () => ({ completeLearningCoverageSession }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

import { MatchSession } from "@/features/match/components/match-session";
import type { StartedMatchSession } from "@/features/match/types/match-types";

const session: StartedMatchSession = {
  coverageSessionId: "11111111-1111-1111-1111-111111111111",
  selectedCount: 12,
  eligibleCount: 12,
  batches: [
    {
      fronts: ["a", "b", "c", "d", "e", "f"].map((id) => ({
        id,
        front: `front-${id}`,
        back: `back-${id}`,
      })),
      backs: ["a", "b", "c", "d", "e", "f"].map((id) => ({
        id,
        front: `front-${id}`,
        back: `back-${id}`,
      })),
    },
  ],
};

describe("MatchSession visibility pause", () => {
  beforeEach(() => {
    startMatchCoverageSession.mockReset();
    completeLearningCoverageSession.mockReset();
    router.push.mockReset();
    router.back.mockReset();
    startMatchCoverageSession.mockResolvedValue({ ok: true, session });
    completeLearningCoverageSession.mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
  });

  it("pauses on hidden tab, blocks matching, and resumes on continue", async () => {
    render(
      <MatchSession
        sessionHref="/match/session?all=1&count=12"
        questionCount={12}
        exitHref="/study/mode?all=1"
        mascotLevel={1}
      />,
    );

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "front-a" })).toBeInTheDocument(),
    );

    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    act(() => document.dispatchEvent(new Event("visibilitychange")));

    expect(screen.getByRole("dialog", { name: "Đã tạm dừng" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "front-a" }));
    fireEvent.click(screen.getByRole("button", { name: "back-b" }));
    expect(screen.queryByText("Chưa đúng, thử cặp khác.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "front-a" })).not.toHaveAttribute(
      "aria-pressed",
      "true",
    );

    fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));

    expect(screen.queryByRole("dialog", { name: "Đã tạm dừng" })).not.toBeInTheDocument();
  });
});
