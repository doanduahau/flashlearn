import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { startMemoryCoverageSession, completeLearningCoverageSession, recordDailyActivity, router } =
  vi.hoisted(() => ({
    startMemoryCoverageSession: vi.fn(),
    completeLearningCoverageSession: vi.fn(),
    recordDailyActivity: vi.fn(),
    router: { push: vi.fn(), back: vi.fn(), refresh: vi.fn() },
  }));

vi.mock("@/features/memory/server/actions", () => ({ startMemoryCoverageSession }));
vi.mock("@/features/practice-coverage/server/actions", () => ({ completeLearningCoverageSession }));
vi.mock("@/features/learning-modes/server/record-activity", () => ({ recordDailyActivity }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

import { MemorySession } from "@/features/memory/components/memory-session";
import type { StartedMemorySession } from "@/features/memory/types/memory-types";

const session: StartedMemorySession = {
  coverageSessionId: "22222222-2222-2222-2222-222222222222",
  selectedCount: 12,
  eligibleCount: 12,
  batches: [
    {
      tiles: ["a", "b", "c", "d", "e", "f"].flatMap((id) => [
        { key: `${id}:front`, cardId: id, side: "front" as const, content: `front-${id}` },
        { key: `${id}:back`, cardId: id, side: "back" as const, content: `back-${id}` },
      ]),
    },
  ],
};

describe("MemorySession visibility pause", () => {
  beforeEach(() => {
    startMemoryCoverageSession.mockReset();
    completeLearningCoverageSession.mockReset();
    router.push.mockReset();
    router.back.mockReset();
    startMemoryCoverageSession.mockResolvedValue({ ok: true, session });
    completeLearningCoverageSession.mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
  });

  it("pauses on hidden tab, blocks tile flips, and resumes on continue", async () => {
    render(
      <MemorySession
        sessionHref="/memory/session?all=1&count=12"
        questionCount={12}
        exitHref="/study/mode?all=1"
        mascotLevel={1}
      />,
    );

    await waitFor(() => expect(screen.getByTestId("a:front")).toBeInTheDocument());

    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    act(() => document.dispatchEvent(new Event("visibilitychange")));

    expect(screen.getByRole("dialog", { name: "Đã tạm dừng" })).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("a:front"));
    expect(screen.getByTestId("a:front")).toHaveAttribute("aria-label", "Ô úp");

    fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" }));

    expect(screen.queryByRole("dialog", { name: "Đã tạm dừng" })).not.toBeInTheDocument();
  });
});
