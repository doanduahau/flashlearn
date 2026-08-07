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

describe("CalendarDayCell", () => {
  it("in fine-pointer mode reveals the overlay with hover/focus classes, no state required", () => {
    const onTap = vi.fn();
    render(
      <CalendarDayCell
        day={dayCell("2026-08-06", "2026-08-31", detail)}
        today="2026-08-31"
        timezone="Asia/Ho_Chi_Minh"
        isCoarse={false}
        isOpen={false}
        onTap={onTap}
      />,
    );

    const overlay = screen.getByRole("dialog", { name: "Chi tiết hoạt động" });
    expect(overlay).toHaveTextContent("2 bài kiểm tra · 20 câu");
    expect(overlay).toHaveTextContent("14 câu đúng · Độ chính xác 70%");
    expect(overlay).toHaveClass("group-hover:opacity-100", "group-focus-within:opacity-100");
    expect(overlay).not.toHaveClass("visible");

    const cell = screen.getByRole("button", { name: /06\/08\/2026, có hoạt động/ });
    expect(cell).toHaveClass("group");
  });

  it("renders a flame label for a streak day and a plain label otherwise", () => {
    const flame = render(
      <CalendarDayCell
        day={dayCell("2026-08-06", "2026-08-31", detail, true)}
        today="2026-08-31"
        timezone="Asia/Ho_Chi_Minh"
        isCoarse={false}
        isOpen={false}
        onTap={vi.fn()}
      />,
    );
    expect(flame.getByRole("button", { name: /thuộc chuỗi học tập/ })).toBeInTheDocument();

    const plain = render(
      <CalendarDayCell
        day={dayCell("2026-08-06", "2026-08-31", detail, false)}
        today="2026-08-31"
        timezone="Asia/Ho_Chi_Minh"
        isCoarse={false}
        isOpen={false}
        onTap={vi.fn()}
      />,
    );
    expect(plain.getByRole("button", { name: /có hoạt động$/ })).toBeInTheDocument();
  });

  it("in coarse-pointer mode shows the overlay from state and without hover classes", () => {
    render(
      <CalendarDayCell
        day={dayCell("2026-08-06", "2026-08-31", detail)}
        today="2026-08-31"
        timezone="Asia/Ho_Chi_Minh"
        isCoarse
        isOpen
        onTap={vi.fn()}
      />,
    );

    const overlay = screen.getByRole("dialog", { name: "Chi tiết hoạt động" });
    expect(overlay).toHaveClass("visible", "opacity-100");
    expect(overlay).not.toHaveClass("group-hover:opacity-100");
  });

  it("in coarse mode keeps the overlay hidden unless its own date is open", () => {
    render(
      <CalendarDayCell
        day={dayCell("2026-08-06", "2026-08-31", detail)}
        today="2026-08-31"
        timezone="Asia/Ho_Chi_Minh"
        isCoarse
        isOpen={false}
        onTap={vi.fn()}
      />,
    );

    const overlay = screen.getByRole("dialog", { name: "Chi tiết hoạt động" });
    expect(overlay).not.toHaveClass("visible");
  });

  it("fires onTap on tap without relying on focus", async () => {
    const onTap = vi.fn();
    const user = userEvent.setup();
    render(
      <CalendarDayCell
        day={dayCell("2026-08-06", "2026-08-31", detail)}
        today="2026-08-31"
        timezone="Asia/Ho_Chi_Minh"
        isCoarse
        isOpen={false}
        onTap={onTap}
      />,
    );

    await user.click(screen.getByRole("button", { name: /06\/08\/2026, có hoạt động/ }));
    expect(onTap).toHaveBeenCalledTimes(1);
  });

  it("disables cells that are in the future or inactive", () => {
    render(
      <CalendarDayCell
        day={dayCell("2026-08-31", "2026-08-06", null)}
        today="2026-08-06"
        timezone="Asia/Ho_Chi_Minh"
        isCoarse={false}
        isOpen={false}
        onTap={vi.fn()}
      />,
    );
    expect(screen.getByRole("button")).toBeDisabled();
  });
});
