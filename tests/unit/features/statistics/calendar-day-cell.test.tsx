import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CalendarDayCell } from "@/features/statistics/components/calendar-day-cell";
import { calendarDays, type DailyActivityDetail } from "@/features/statistics/utils/month-activity";

function dayCell(date: string, today: string, detail: DailyActivityDetail | null, flame = false) {
  const map = detail ? new Map([[date, detail]]) : new Map();
  const month = date.slice(0, 7);
  const days = calendarDays(month, map, today, flame ? [date] : []);
  return days.find((day) => day.date === date)!;
}

const detail: DailyActivityDetail = {
  date: "2026-08-06",
  quizCount: 2,
  questions: 20,
  correct: 14,
};

/** Default no-op handlers for desktop event props */
const noop = vi.fn();
const defaultProps = {
  onTap: noop,
  onDesktopMouseEnter: noop,
  onDesktopMouseLeave: noop,
  onDesktopFocus: noop,
  onDesktopBlur: noop,
};

describe("CalendarDayCell", () => {
  it("in fine-pointer mode does NOT render an inline detail overlay (desktop uses portal)", () => {
    render(
      <CalendarDayCell
        {...defaultProps}
        day={dayCell("2026-08-06", "2026-08-31", detail)}
        today="2026-08-31"
        timezone="Asia/Ho_Chi_Minh"
        isCoarse={false}
        isOpen={false}
      />,
    );

    // On desktop (isCoarse=false) there is no inline detail element —
    // the portal is managed by ActivityCalendarGrid, not the cell itself.
    expect(screen.queryByRole("dialog", { name: "Chi tiết hoạt động" })).not.toBeInTheDocument();

    // The button should NOT have `group` since hover CSS is no longer used
    const cell = screen.getByRole("button", { name: /06\/08\/2026, có hoạt động/ });
    expect(cell).not.toHaveClass("group");
  });

  it("renders a flame label for a streak day and a plain label otherwise", () => {
    const flame = render(
      <CalendarDayCell
        {...defaultProps}
        day={dayCell("2026-08-06", "2026-08-31", detail, true)}
        today="2026-08-31"
        timezone="Asia/Ho_Chi_Minh"
        isCoarse={false}
        isOpen={false}
      />,
    );
    expect(flame.getByRole("button", { name: /thuộc chuỗi học tập/ })).toBeInTheDocument();

    const plain = render(
      <CalendarDayCell
        {...defaultProps}
        day={dayCell("2026-08-06", "2026-08-31", detail, false)}
        today="2026-08-31"
        timezone="Asia/Ho_Chi_Minh"
        isCoarse={false}
        isOpen={false}
      />,
    );
    expect(plain.getByRole("button", { name: /có hoạt động$/ })).toBeInTheDocument();
  });

  it("in coarse-pointer mode shows the inline overlay when isOpen=true", () => {
    render(
      <CalendarDayCell
        {...defaultProps}
        day={dayCell("2026-08-06", "2026-08-31", detail)}
        today="2026-08-31"
        timezone="Asia/Ho_Chi_Minh"
        isCoarse
        isOpen
      />,
    );

    const overlay = screen.getByRole("dialog", { name: "Chi tiết hoạt động" });
    expect(overlay).toHaveClass("visible", "opacity-100");
    // Inline overlay must NOT have desktop hover classes
    expect(overlay).not.toHaveClass("group-hover:opacity-100");
    expect(overlay).toHaveTextContent("2 bài kiểm tra · 20 câu");
    expect(overlay).toHaveTextContent("14 câu đúng · Độ chính xác 70%");
  });

  it("in coarse mode does not mount the inline overlay when isOpen=false", () => {
    render(
      <CalendarDayCell
        {...defaultProps}
        day={dayCell("2026-08-06", "2026-08-31", detail)}
        today="2026-08-31"
        timezone="Asia/Ho_Chi_Minh"
        isCoarse
        isOpen={false}
      />,
    );

    expect(screen.queryByRole("dialog", { name: "Chi tiết hoạt động" })).not.toBeInTheDocument();
  });

  it("fires onTap on click", async () => {
    const onTap = vi.fn();
    const user = userEvent.setup();
    render(
      <CalendarDayCell
        {...defaultProps}
        onTap={onTap}
        day={dayCell("2026-08-06", "2026-08-31", detail)}
        today="2026-08-31"
        timezone="Asia/Ho_Chi_Minh"
        isCoarse
        isOpen={false}
      />,
    );

    await user.click(screen.getByRole("button", { name: /06\/08\/2026, có hoạt động/ }));
    expect(onTap).toHaveBeenCalledTimes(1);
  });

  it("calls onDesktopMouseEnter and onDesktopMouseLeave on hover in fine-pointer mode", async () => {
    const onDesktopMouseEnter = vi.fn();
    const onDesktopMouseLeave = vi.fn();
    const user = userEvent.setup();

    render(
      <CalendarDayCell
        {...defaultProps}
        onDesktopMouseEnter={onDesktopMouseEnter}
        onDesktopMouseLeave={onDesktopMouseLeave}
        day={dayCell("2026-08-06", "2026-08-31", detail)}
        today="2026-08-31"
        timezone="Asia/Ho_Chi_Minh"
        isCoarse={false}
        isOpen={false}
      />,
    );

    const button = screen.getByRole("button", { name: /06\/08\/2026, có hoạt động/ });
    await user.hover(button);
    expect(onDesktopMouseEnter).toHaveBeenCalledTimes(1);
    await user.unhover(button);
    expect(onDesktopMouseLeave).toHaveBeenCalledTimes(1);
  });

  it("does NOT attach desktop event handlers in coarse mode", () => {
    render(
      <CalendarDayCell
        {...defaultProps}
        day={dayCell("2026-08-06", "2026-08-31", detail)}
        today="2026-08-31"
        timezone="Asia/Ho_Chi_Minh"
        isCoarse
        isOpen={false}
      />,
    );

    const button = screen.getByRole("button", { name: /06\/08\/2026, có hoạt động/ });
    // In coarse mode, onMouseEnter/onMouseLeave are explicitly set to undefined on the element
    expect(button.onmouseenter).toBeNull();
    expect(button.onmouseleave).toBeNull();
  });

  it("disables cells that are in the future or inactive", () => {
    render(
      <CalendarDayCell
        {...defaultProps}
        day={dayCell("2026-08-31", "2026-08-06", null)}
        today="2026-08-06"
        timezone="Asia/Ho_Chi_Minh"
        isCoarse={false}
        isOpen={false}
      />,
    );
    expect(screen.getByRole("button")).toBeDisabled();
  });
});
