import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createShareLink: vi.fn(),
  revokeShareLink: vi.fn(),
  setClassroomEnabled: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/features/sharing/server/actions", () => ({
  createShareLink: mocks.createShareLink,
  revokeShareLink: mocks.revokeShareLink,
  setClassroomEnabled: mocks.setClassroomEnabled,
}));

import { ShareDialog } from "@/features/sharing/components/share-dialog";

const SET_ID = "11111111-1111-4111-8111-111111111111";
const TOKEN = "0".repeat(32);

describe("ShareDialog", () => {
  beforeEach(() => {
    mocks.createShareLink.mockReset();
    mocks.revokeShareLink.mockReset();
    mocks.setClassroomEnabled.mockReset();
    mocks.refresh.mockReset();
    mocks.createShareLink.mockResolvedValue({ ok: true });
    mocks.revokeShareLink.mockResolvedValue({ ok: true });
    mocks.setClassroomEnabled.mockResolvedValue({ ok: true });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it("shows a create button when the set is not shared yet", () => {
    render(<ShareDialog setId={SET_ID} hasToken={false} token={null} classroomEnabled={false} />);
    expect(screen.getByRole("button", { name: /chia sẻ/i })).toBeInTheDocument();
  });

  it("creates a share link and shows the shared state after refresh", async () => {
    const user = userEvent.setup();
    render(<ShareDialog setId={SET_ID} hasToken={false} token={null} classroomEnabled={false} />);
    await user.click(screen.getByRole("button", { name: /chia sẻ/i }));
    await user.click(screen.getByRole("button", { name: /tạo link chia sẻ/i }));

    await waitFor(() => expect(mocks.createShareLink).toHaveBeenCalledWith(SET_ID));
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it("shows the link and copy feedback when a token already exists", async () => {
    const user = userEvent.setup();
    render(<ShareDialog setId={SET_ID} hasToken={true} token={TOKEN} classroomEnabled={false} />);
    await user.click(screen.getByRole("button", { name: /chia sẻ/i }));

    expect(screen.getByText(new RegExp(`/share/${TOKEN}`))).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /sao chép link/i }));
    await waitFor(() => expect(screen.getByText("Đã sao chép!")).toBeInTheDocument());
  });

  it("requires confirmation before revoking the share link", async () => {
    const user = userEvent.setup();
    render(<ShareDialog setId={SET_ID} hasToken={true} token={TOKEN} classroomEnabled={false} />);
    await user.click(screen.getByRole("button", { name: /chia sẻ/i }));
    await user.click(screen.getByRole("button", { name: /tắt chia sẻ/i }));

    expect(mocks.revokeShareLink).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /^tắt$/i }));
    await waitFor(() => expect(mocks.revokeShareLink).toHaveBeenCalledWith(SET_ID));
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it("toggles classroom mode and shows the explanation when enabled", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <ShareDialog setId={SET_ID} hasToken={true} token={TOKEN} classroomEnabled={false} />,
    );
    await user.click(screen.getByRole("button", { name: /chia sẻ/i }));

    await user.click(screen.getByRole("checkbox", { name: /chế độ lớp học/i }));
    await waitFor(() => expect(mocks.setClassroomEnabled).toHaveBeenCalledWith(SET_ID, true));

    rerender(<ShareDialog setId={SET_ID} hasToken={true} token={TOKEN} classroomEnabled={true} />);
    expect(screen.getByText(/học sinh mở link sẽ thấy thông báo/i)).toBeInTheDocument();
  });

  it("surfaces a recoverable error when creating a link fails", async () => {
    mocks.createShareLink.mockResolvedValue({
      ok: false,
      error: "Không thể tạo link chia sẻ lúc này.",
    });
    const user = userEvent.setup();
    render(<ShareDialog setId={SET_ID} hasToken={false} token={null} classroomEnabled={false} />);
    await user.click(screen.getByRole("button", { name: /chia sẻ/i }));
    await user.click(screen.getByRole("button", { name: /tạo link chia sẻ/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Không thể tạo link chia sẻ lúc này.",
    );
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});
