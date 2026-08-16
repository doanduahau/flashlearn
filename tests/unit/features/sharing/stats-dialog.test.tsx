import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));

import { StatsDialog, type MemberStats } from "@/features/sharing/components/stats-dialog";

const MASCOT_LEVEL = 3;

const MEMBERS: MemberStats[] = [
  {
    rank: 1,
    member_user_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    display_name: "Nguyễn Văn A",
    avatar_url: null,
    joined_at: "2026-08-01T08:00:00+00:00",
    total_questions: 18,
    correct_questions: 13,
    accuracy: 72.2,
    last_activity_at: "2026-08-11T12:00:00+00:00",
  },
  {
    rank: 2,
    member_user_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    display_name: "Học sinh B",
    avatar_url: "https://example.com/b.png",
    joined_at: "2026-08-02T08:00:00+00:00",
    total_questions: 6,
    correct_questions: 4,
    accuracy: 66.7,
    last_activity_at: "2026-08-12T10:00:00+00:00",
  },
];

describe("StatsDialog", () => {
  beforeEach(() => {
    mocks.refresh.mockReset();
  });

  it("renders a stats trigger button with the teacher-only label", () => {
    render(<StatsDialog members={[]} mascotLevel={MASCOT_LEVEL} />);
    expect(screen.getByRole("button", { name: /thống kê học sinh/i })).toBeInTheDocument();
  });

  it("renders the empty state with mascot and guidance when there are no members", async () => {
    const user = userEvent.setup();
    render(<StatsDialog members={[]} mascotLevel={MASCOT_LEVEL} />);
    await user.click(screen.getByRole("button", { name: /thống kê học sinh/i }));

    expect(screen.getByRole("dialog", { name: /thống kê lớp học/i })).toBeInTheDocument();
    expect(screen.getByText("Chỉ bạn xem được bảng này.")).toBeInTheDocument();
    expect(screen.getByText("Chưa có học sinh nào tham gia lớp học.")).toBeInTheDocument();
    expect(screen.getByText("Chia sẻ link lớp học để học sinh tham gia.")).toBeInTheDocument();
    expect(screen.getByAltText("")).toBeInTheDocument();
  });

  it("renders a row per member with all metric columns", async () => {
    const user = userEvent.setup();
    render(<StatsDialog members={MEMBERS} mascotLevel={MASCOT_LEVEL} />);
    await user.click(screen.getByRole("button", { name: /thống kê học sinh/i }));

    expect(screen.getByText("Nguyễn Văn A")).toBeInTheDocument();
    expect(screen.getByText("Học sinh B")).toBeInTheDocument();

    expect(screen.getAllByText("Tổng câu đã làm")).toHaveLength(2);
    expect(screen.getAllByText("Số câu đúng")).toHaveLength(2);
    expect(screen.getAllByText("Tỉ lệ chính xác")).toHaveLength(2);
    expect(screen.getAllByText("Ngày tham gia")).toHaveLength(2);
    expect(screen.getAllByText("Hoạt động gần nhất")).toHaveLength(2);

    expect(screen.getByText("72.2%")).toBeInTheDocument();
    expect(screen.getByText("66.7%")).toBeInTheDocument();
  });

  it("renders an initials avatar when the member has no avatar_url", async () => {
    const user = userEvent.setup();
    render(<StatsDialog members={MEMBERS} mascotLevel={MASCOT_LEVEL} />);
    await user.click(screen.getByRole("button", { name: /thống kê học sinh/i }));

    expect(screen.getByText("NV")).toBeInTheDocument();
  });

  it("falls back to Học sinh when display_name is missing", async () => {
    const user = userEvent.setup();
    render(
      <StatsDialog
        members={[
          {
            ...MEMBERS[0],
            display_name: null,
            member_user_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          },
        ]}
        mascotLevel={MASCOT_LEVEL}
      />,
    );
    await user.click(screen.getByRole("button", { name: /thống kê học sinh/i }));

    expect(screen.getByText("Học sinh")).toBeInTheDocument();
  });

  it("renders a dash for accuracy and last activity when null", async () => {
    const user = userEvent.setup();
    render(
      <StatsDialog
        members={[{ ...MEMBERS[0], accuracy: null, last_activity_at: null }]}
        mascotLevel={MASCOT_LEVEL}
      />,
    );
    await user.click(screen.getByRole("button", { name: /thống kê học sinh/i }));

    const dashCount = screen.getAllByText("—").length;
    expect(dashCount).toBeGreaterThanOrEqual(2);
  });

  it("refreshes the router when the Làm mới button is clicked", async () => {
    const user = userEvent.setup();
    render(<StatsDialog members={MEMBERS} mascotLevel={MASCOT_LEVEL} />);
    await user.click(screen.getByRole("button", { name: /thống kê học sinh/i }));

    await user.click(screen.getByRole("button", { name: /làm mới/i }));
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it("closes the dialog with the close button", async () => {
    const user = userEvent.setup();
    render(<StatsDialog members={MEMBERS} mascotLevel={MASCOT_LEVEL} />);
    await user.click(screen.getByRole("button", { name: /thống kê học sinh/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /đóng/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
