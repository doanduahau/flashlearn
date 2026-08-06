import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createCollection: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/features/special-collections/server/actions", () => ({
  createCollection: mocks.createCollection,
}));

import { CreateCollectionForm } from "@/features/special-collections/components/create-collection-form";

describe("CreateCollectionForm", () => {
  beforeEach(() => {
    mocks.createCollection.mockReset();
    mocks.refresh.mockReset();
    mocks.createCollection.mockResolvedValue({ ok: true });
  });

  it("renders the collection name field and submit button", () => {
    render(<CreateCollectionForm />);
    expect(screen.getByLabelText(/tên bộ/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /tạo bộ/i })).toBeInTheDocument();
  });

  it("submits the trimmed name and clears the field on success", async () => {
    const user = userEvent.setup();
    render(<CreateCollectionForm />);
    await user.type(screen.getByLabelText(/tên bộ/i), "  Khó nhớ  ");
    await user.click(screen.getByRole("button", { name: /tạo bộ/i }));
    await waitFor(() =>
      expect(mocks.createCollection).toHaveBeenCalledWith({ name: "  Khó nhớ  " }),
    );
    expect(mocks.refresh).toHaveBeenCalled();
    expect(screen.getByLabelText(/tên bộ/i)).toHaveValue("");
  });

  it("shows a recoverable error and keeps the entered name", async () => {
    mocks.createCollection.mockResolvedValue({ ok: false, error: "Tên đã tồn tại." });
    const user = userEvent.setup();
    render(<CreateCollectionForm />);
    await user.type(screen.getByLabelText(/tên bộ/i), "Khó nhớ");
    await user.click(screen.getByRole("button", { name: /tạo bộ/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Tên đã tồn tại.");
    expect(screen.getByLabelText(/tên bộ/i)).toHaveValue("Khó nhớ");
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("prevents duplicate submission while pending", async () => {
    let resolveAction: ((result: { ok: true }) => void) | undefined;
    mocks.createCollection.mockReturnValue(
      new Promise((resolve) => {
        resolveAction = resolve;
      }),
    );
    const user = userEvent.setup();
    render(<CreateCollectionForm />);
    await user.type(screen.getByLabelText(/tên bộ/i), "Bộ mới");
    const submit = screen.getByRole("button", { name: /tạo bộ/i });
    await user.click(submit);
    expect(submit).toBeDisabled();
    await user.click(submit);
    expect(mocks.createCollection).toHaveBeenCalledTimes(1);
    resolveAction?.({ ok: true });
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1));
  });

  it("disables submit for a whitespace-only name", async () => {
    const user = userEvent.setup();
    render(<CreateCollectionForm />);
    await user.type(screen.getByLabelText(/tên bộ/i), "   ");
    expect(screen.getByRole("button", { name: /tạo bộ/i })).toBeDisabled();
  });
});
