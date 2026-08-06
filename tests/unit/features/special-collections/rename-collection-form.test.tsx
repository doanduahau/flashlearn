import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  renameCollection: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/features/special-collections/server/actions", () => ({
  renameCollection: mocks.renameCollection,
}));

import { RenameCollectionForm } from "@/features/special-collections/components/rename-collection-form";

const COLLECTION_ID = "11111111-1111-4111-8111-111111111111";

describe("RenameCollectionForm", () => {
  beforeEach(() => {
    mocks.renameCollection.mockReset();
    mocks.refresh.mockReset();
    mocks.renameCollection.mockResolvedValue({ ok: true });
  });

  it("renders a rename trigger with an accessible label", () => {
    render(<RenameCollectionForm collectionId={COLLECTION_ID} initialName="Khó nhớ" />);
    expect(screen.getByRole("button", { name: /đổi tên/i })).toBeInTheDocument();
  });

  it("opens the form prefilled with the current name", async () => {
    const user = userEvent.setup();
    render(<RenameCollectionForm collectionId={COLLECTION_ID} initialName="Khó nhớ" />);
    await user.click(screen.getByRole("button", { name: /đổi tên/i }));
    expect(screen.getByLabelText(/tên bộ/i)).toHaveValue("Khó nhớ");
  });

  it("submits the trimmed name and closes the form on success", async () => {
    const user = userEvent.setup();
    render(<RenameCollectionForm collectionId={COLLECTION_ID} initialName="Khó nhớ" />);
    await user.click(screen.getByRole("button", { name: /đổi tên/i }));
    const input = screen.getByLabelText(/tên bộ/i);
    await user.clear(input);
    await user.type(input, "  Yêu thích  ");
    await user.click(screen.getByRole("button", { name: /lưu/i }));
    await waitFor(() =>
      expect(mocks.renameCollection).toHaveBeenCalledWith({
        collectionId: COLLECTION_ID,
        name: "  Yêu thích  ",
      }),
    );
    expect(mocks.refresh).toHaveBeenCalled();
    expect(screen.queryByLabelText(/tên bộ/i)).not.toBeInTheDocument();
  });

  it("keeps the form open with entered values after a recoverable error", async () => {
    mocks.renameCollection.mockResolvedValue({ ok: false, error: "Tên đã tồn tại." });
    const user = userEvent.setup();
    render(<RenameCollectionForm collectionId={COLLECTION_ID} initialName="Khó nhớ" />);
    await user.click(screen.getByRole("button", { name: /đổi tên/i }));
    const input = screen.getByLabelText(/tên bộ/i);
    await user.clear(input);
    await user.type(input, "Yêu thích");
    await user.click(screen.getByRole("button", { name: /lưu/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Tên đã tồn tại.");
    expect(screen.getByLabelText(/tên bộ/i)).toHaveValue("Yêu thích");
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("prevents duplicate submission while pending", async () => {
    let resolveAction: ((result: { ok: true }) => void) | undefined;
    mocks.renameCollection.mockReturnValue(
      new Promise((resolve) => {
        resolveAction = resolve;
      }),
    );
    const user = userEvent.setup();
    render(<RenameCollectionForm collectionId={COLLECTION_ID} initialName="Khó nhớ" />);
    await user.click(screen.getByRole("button", { name: /đổi tên/i }));
    const input = screen.getByLabelText(/tên bộ/i);
    await user.clear(input);
    await user.type(input, "Bộ mới");
    const save = screen.getByRole("button", { name: /lưu/i });
    await user.click(save);
    expect(save).toBeDisabled();
    await user.click(save);
    expect(mocks.renameCollection).toHaveBeenCalledTimes(1);
    resolveAction?.({ ok: true });
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1));
  });

  it("cancels and resets the form", async () => {
    const user = userEvent.setup();
    render(<RenameCollectionForm collectionId={COLLECTION_ID} initialName="Khó nhớ" />);
    await user.click(screen.getByRole("button", { name: /đổi tên/i }));
    await user.click(screen.getByRole("button", { name: /hủy/i }));
    expect(screen.queryByLabelText(/tên bộ/i)).not.toBeInTheDocument();
    expect(mocks.renameCollection).not.toHaveBeenCalled();
  });
});
