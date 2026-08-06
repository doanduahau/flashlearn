import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  deleteCollection: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace }) }));
vi.mock("@/features/special-collections/server/actions", () => ({
  deleteCollection: mocks.deleteCollection,
}));

import { DeleteCollectionButton } from "@/features/special-collections/components/delete-collection-button";

const COLLECTION_ID = "11111111-1111-4111-8111-111111111111";

describe("DeleteCollectionButton", () => {
  beforeEach(() => {
    mocks.deleteCollection.mockReset();
    mocks.replace.mockReset();
    mocks.deleteCollection.mockResolvedValue({ ok: true });
  });

  it("renders a destructive trigger", () => {
    render(<DeleteCollectionButton collectionId={COLLECTION_ID} />);
    expect(screen.getByRole("button", { name: /xóa bộ/i })).toBeInTheDocument();
  });

  it("requires explicit confirmation before deleting", async () => {
    const user = userEvent.setup();
    render(<DeleteCollectionButton collectionId={COLLECTION_ID} />);
    await user.click(screen.getByRole("button", { name: /xóa bộ/i }));
    expect(screen.getByText(/xóa bộ đặc biệt này/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /xóa vĩnh viễn/i })).toBeInTheDocument();
    expect(mocks.deleteCollection).not.toHaveBeenCalled();
  });

  it("cancels the confirmation without deleting", async () => {
    const user = userEvent.setup();
    render(<DeleteCollectionButton collectionId={COLLECTION_ID} />);
    await user.click(screen.getByRole("button", { name: /xóa bộ/i }));
    await user.click(screen.getByRole("button", { name: /hủy/i }));
    expect(screen.queryByText(/xóa bộ đặc biệt này/i)).not.toBeInTheDocument();
    expect(mocks.deleteCollection).not.toHaveBeenCalled();
  });

  it("deletes and redirects to the collection list on confirmation", async () => {
    const user = userEvent.setup();
    render(<DeleteCollectionButton collectionId={COLLECTION_ID} />);
    await user.click(screen.getByRole("button", { name: /xóa bộ/i }));
    await user.click(screen.getByRole("button", { name: /xóa vĩnh viễn/i }));
    await waitFor(() =>
      expect(mocks.deleteCollection).toHaveBeenCalledWith({ collectionId: COLLECTION_ID }),
    );
    expect(mocks.replace).toHaveBeenCalledWith("/collections");
  });

  it("shows a recoverable error and resets the confirmation", async () => {
    mocks.deleteCollection.mockResolvedValue({
      ok: false,
      error: "Không tìm thấy bộ đặc biệt.",
    });
    const user = userEvent.setup();
    render(<DeleteCollectionButton collectionId={COLLECTION_ID} />);
    await user.click(screen.getByRole("button", { name: /xóa bộ/i }));
    await user.click(screen.getByRole("button", { name: /xóa vĩnh viễn/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Không tìm thấy bộ đặc biệt.");
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(screen.queryByText(/xóa bộ đặc biệt này/i)).not.toBeInTheDocument();
  });

  it("prevents duplicate submission while pending", async () => {
    let resolveAction: ((result: { ok: true }) => void) | undefined;
    mocks.deleteCollection.mockReturnValue(
      new Promise((resolve) => {
        resolveAction = resolve;
      }),
    );
    const user = userEvent.setup();
    render(<DeleteCollectionButton collectionId={COLLECTION_ID} />);
    await user.click(screen.getByRole("button", { name: /xóa bộ/i }));
    const confirm = screen.getByRole("button", { name: /xóa vĩnh viễn/i });
    await user.click(confirm);
    expect(confirm).toBeDisabled();
    await user.click(confirm);
    expect(mocks.deleteCollection).toHaveBeenCalledTimes(1);
    resolveAction?.({ ok: true });
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledTimes(1));
  });
});
