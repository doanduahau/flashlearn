import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  deleteSet: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace }) }));
vi.mock("@/features/flashcard-sets/server/actions", () => ({ deleteSet: mocks.deleteSet }));

import { DeleteSetButton } from "@/features/flashcard-sets/components/delete-set-button";

const SET_ID = "11111111-1111-4111-8111-111111111111";

describe("DeleteSetButton", () => {
  beforeEach(() => {
    mocks.deleteSet.mockReset();
    mocks.replace.mockReset();
    mocks.deleteSet.mockResolvedValue({ ok: true });
  });

  it("renders a destructive trigger", () => {
    render(<DeleteSetButton setId={SET_ID} />);
    expect(screen.getByRole("button", { name: /xóa bộ/i })).toBeInTheDocument();
  });

  it("requires explicit confirmation before deleting", async () => {
    const user = userEvent.setup();
    render(<DeleteSetButton setId={SET_ID} />);
    await user.click(screen.getByRole("button", { name: /xóa bộ/i }));
    expect(screen.getByText(/xóa bộ flashcard này/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /xóa vĩnh viễn/i })).toBeInTheDocument();
    expect(mocks.deleteSet).not.toHaveBeenCalled();
  });

  it("cancels the confirmation without deleting", async () => {
    const user = userEvent.setup();
    render(<DeleteSetButton setId={SET_ID} />);
    await user.click(screen.getByRole("button", { name: /xóa bộ/i }));
    await user.click(screen.getByRole("button", { name: /hủy/i }));
    expect(screen.queryByText(/xóa bộ flashcard này/i)).not.toBeInTheDocument();
    expect(mocks.deleteSet).not.toHaveBeenCalled();
  });

  it("deletes and redirects to the set list on confirmation", async () => {
    const user = userEvent.setup();
    render(<DeleteSetButton setId={SET_ID} />);
    await user.click(screen.getByRole("button", { name: /xóa bộ/i }));
    await user.click(screen.getByRole("button", { name: /xóa vĩnh viễn/i }));
    await waitFor(() => expect(mocks.deleteSet).toHaveBeenCalledWith({ setId: SET_ID }));
    expect(mocks.replace).toHaveBeenCalledWith("/sets");
  });

  it("shows a recoverable error and resets the confirmation", async () => {
    mocks.deleteSet.mockResolvedValue({ ok: false, error: "Không tìm thấy bộ flashcard." });
    const user = userEvent.setup();
    render(<DeleteSetButton setId={SET_ID} />);
    await user.click(screen.getByRole("button", { name: /xóa bộ/i }));
    await user.click(screen.getByRole("button", { name: /xóa vĩnh viễn/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Không tìm thấy bộ flashcard.");
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(screen.queryByText(/xóa bộ flashcard này/i)).not.toBeInTheDocument();
  });

  it("prevents duplicate submission while pending", async () => {
    let resolveAction: ((result: { ok: true }) => void) | undefined;
    mocks.deleteSet.mockReturnValue(
      new Promise((resolve) => {
        resolveAction = resolve;
      }),
    );
    const user = userEvent.setup();
    render(<DeleteSetButton setId={SET_ID} />);
    await user.click(screen.getByRole("button", { name: /xóa bộ/i }));
    const confirm = screen.getByRole("button", { name: /xóa vĩnh viễn/i });
    await user.click(confirm);
    expect(confirm).toBeDisabled();
    await user.click(confirm);
    expect(mocks.deleteSet).toHaveBeenCalledTimes(1);
    resolveAction?.({ ok: true });
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledTimes(1));
  });
});
