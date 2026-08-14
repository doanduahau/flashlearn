import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import type { ReactNode } from "react";

const mocks = vi.hoisted(() => ({
  getMemoryAvailability: vi.fn() as Mock,
  getRunnerAvailability: vi.fn() as Mock,
  startRunnerSession: vi.fn() as Mock,
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@/features/memory/server/actions", () => ({
  getMemoryAvailability: mocks.getMemoryAvailability,
}));
vi.mock("@/features/runner/server/actions", () => ({
  getRunnerAvailability: mocks.getRunnerAvailability,
  startRunnerSession: mocks.startRunnerSession,
}));

import { StudyModeSelect } from "@/features/study/components/study-mode-select";

const source = { all: true, setIds: [], collectionIds: [] };

describe("StudyModeSelect", () => {
  beforeEach(() => {
    mocks.push.mockReset();
    mocks.startRunnerSession.mockReset();
    mocks.getMemoryAvailability.mockResolvedValue({
      ok: true,
      eligibleCount: 24,
      eligibility: { availableCounts: [12, 18, 24], message: null },
    });
    mocks.getRunnerAvailability.mockResolvedValue({
      ok: true,
      eligibleCount: 24,
      eligibility: { availableCounts: [12, 18, 24], message: null, hiddenByEligibility: false },
    });
  });

  it("renders exactly the three requested modes and starts normal study directly", async () => {
    const user = userEvent.setup();
    render(<StudyModeSelect source={source} totalCards={24} />);
    expect(screen.getByRole("heading", { name: "Lật thẻ" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Memory matching" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Capy runner" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Bắt đầu lật thẻ" }));
    expect(mocks.push).toHaveBeenCalledWith("/study/session?all=1");
  });

  it("reveals Memory counts and Runner count plus difficulty controls only after selecting a mode", async () => {
    const user = userEvent.setup();
    render(<StudyModeSelect source={source} totalCards={24} />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Bắt đầu Memory" })).toBeVisible(),
    );
    expect(screen.queryAllByRole("button", { name: "12 câu" })).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "Bắt đầu Memory" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "12 câu" })).toBeVisible());
    await user.click(screen.getByRole("button", { name: "Bắt đầu Runner" }));
    expect(screen.getByRole("button", { name: "Dễ" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Vừa" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Khó" })).toBeVisible();
  });

  it("disables a mode below its exact minimum with the required copy", async () => {
    mocks.getMemoryAvailability.mockResolvedValue({
      ok: true,
      eligibleCount: 7,
      eligibility: { availableCounts: [], message: "not enough" },
    });
    mocks.getRunnerAvailability.mockResolvedValue({
      ok: true,
      eligibleCount: 7,
      eligibility: { availableCounts: [], message: "not enough", hiddenByEligibility: false },
    });
    render(<StudyModeSelect source={source} totalCards={0} />);
    expect(screen.getByRole("button", { name: "Bắt đầu lật thẻ" })).toBeDisabled();
    expect(screen.getByText("Cần tối thiểu 1 thẻ — phạm vi hiện có 0 thẻ")).toBeVisible();
    await waitFor(() =>
      expect(screen.getAllByText("Cần tối thiểu 12 thẻ — phạm vi hiện có 7 thẻ")).toHaveLength(2),
    );
  });
});
