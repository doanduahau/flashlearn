import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cloneSharedSet: vi.fn(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/features/sharing/server/actions", () => ({
  cloneSharedSet: mocks.cloneSharedSet,
}));

import { CloneSetButton } from "@/features/sharing/components/clone-set-button";

const TOKEN = "a".repeat(32);
const SET_ID = "11111111-1111-4111-8111-111111111111";

describe("CloneSetButton", () => {
  beforeEach(() => {
    mocks.cloneSharedSet.mockReset();
    mocks.push.mockReset();
    mocks.cloneSharedSet.mockResolvedValue({ setId: SET_ID, alreadyExists: false });
  });

  it("links to sign-in with a next param for anonymous visitors", () => {
    render(<CloneSetButton token={TOKEN} isAuthenticated={false} isClassroom={false} />);
    const link = screen.getByRole("link", { name: "Đăng nhập để lưu" });
    expect(link).toHaveAttribute("href", `/sign-in?next=/share/${TOKEN}`);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows the classroom label for an authenticated visitor", () => {
    render(<CloneSetButton token={TOKEN} isAuthenticated={true} isClassroom={true} />);
    expect(screen.getByRole("button", { name: "Tham gia lớp học" })).toBeInTheDocument();
  });

  it("shows the default label for a non-classroom link", () => {
    render(<CloneSetButton token={TOKEN} isAuthenticated={true} isClassroom={false} />);
    expect(screen.getByRole("button", { name: "Lưu vào bộ của tôi" })).toBeInTheDocument();
  });

  it("clones on click and navigates to the new set", async () => {
    const user = userEvent.setup();
    render(<CloneSetButton token={TOKEN} isAuthenticated={true} isClassroom={false} />);

    await user.click(screen.getByRole("button", { name: "Lưu vào bộ của tôi" }));
    await waitFor(() => expect(mocks.cloneSharedSet).toHaveBeenCalledWith(TOKEN));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith(`/sets/${SET_ID}`));
  });

  it("disables the button while saving", async () => {
    const user = userEvent.setup();
    let resolve: (value: { setId: string; alreadyExists: boolean }) => void = () => {};
    mocks.cloneSharedSet.mockReturnValue(
      new Promise((res) => {
        resolve = res;
      }),
    );
    render(<CloneSetButton token={TOKEN} isAuthenticated={true} isClassroom={true} />);

    await user.click(screen.getByRole("button", { name: "Tham gia lớp học" }));
    expect(screen.getByRole("button", { name: "Đang lưu" })).toBeDisabled();

    resolve({ setId: SET_ID, alreadyExists: false });
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith(`/sets/${SET_ID}`));
  });

  it("navigates straight to the existing clone when already in the classroom", async () => {
    mocks.cloneSharedSet.mockResolvedValue({ setId: SET_ID, alreadyExists: true });
    const user = userEvent.setup();
    render(<CloneSetButton token={TOKEN} isAuthenticated={true} isClassroom={true} />);

    await user.click(screen.getByRole("button", { name: "Tham gia lớp học" }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith(`/sets/${SET_ID}`));
    expect(screen.queryByText("Bạn đã lưu bộ này.")).not.toBeInTheDocument();
  });

  it("shows an already-saved notice with a link for a plain link instead of cloning again", async () => {
    mocks.cloneSharedSet.mockResolvedValue({ setId: SET_ID, alreadyExists: true });
    const user = userEvent.setup();
    render(<CloneSetButton token={TOKEN} isAuthenticated={true} isClassroom={false} />);

    await user.click(screen.getByRole("button", { name: "Lưu vào bộ của tôi" }));
    await waitFor(() => expect(screen.getByText("Bạn đã lưu bộ này.")).toBeInTheDocument());
    const link = screen.getByRole("link", { name: "Mở bộ flashcard của bạn" });
    expect(link).toHaveAttribute("href", `/sets/${SET_ID}`);
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("shows an inline error and does not navigate when cloning fails", async () => {
    mocks.cloneSharedSet.mockResolvedValue({
      error: "Không thể lưu bộ flashcard này lúc này. Vui lòng thử lại.",
    });
    const user = userEvent.setup();
    render(<CloneSetButton token={TOKEN} isAuthenticated={true} isClassroom={false} />);

    await user.click(screen.getByRole("button", { name: "Lưu vào bộ của tôi" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Không thể lưu bộ flashcard này lúc này. Vui lòng thử lại.",
    );
    expect(mocks.push).not.toHaveBeenCalled();
  });
});
