import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { CalendarDayCell } from "@/features/statistics/components/calendar-day-cell";
import { calendarDays, type DailyActivityDetail } from "@/features/statistics/utils/month-activity";

function dayCell(date: string, today: string, detail: DailyActivityDetail | null) {
  const map = detail ? new Map([[date, detail]]) : new Map();
  return calendarDays(date.slice(0, 7), map, today).find((day) => day.date === date)!;
}

describe("CalendarDayCell", () => {
  it("shows a readable dialog with the day detail on tap", async () => {
    const detail: DailyActivityDetail = {
      date: "2026-08-06",
      quizCount: 2,
      questions: 20,
      correct: 14,
    };
    const user = userEvent.setup();
    render(
      <CalendarDayCell
        day={dayCell("2026-08-06", "2026-08-31", detail)}
        today="2026-08-31"
        timezone="Asia/Ho_Chi_Minh"
      />,
    );

    const cell = screen.getByRole("button", { name: /06\/08\/2026, có hoạt động/ });
    expect(cell).toBeInTheDocument();
    await user.click(cell);

    const popover = screen.getByRole("dialog", { name: "Chi tiết hoạt động" });
    expect(popover).toHaveTextContent("2 bài kiểm tra · 20 câu");
    expect(popover).toHaveTextContent("14 câu đúng · Độ chính xác 70%");
  });

  it("disables cells that are in the future or inactive", () => {
    render(
      <CalendarDayCell
        day={dayCell("2026-08-31", "2026-08-06", null)}
        today="2026-08-06"
        timezone="Asia/Ho_Chi_Minh"
      />,
    );
    expect(screen.getByRole("button")).toBeDisabled();
  });
});
