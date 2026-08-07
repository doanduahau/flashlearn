import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CalendarDayCell } from "@/features/statistics/components/calendar-day-cell";
import { calendarDays, type DailyActivityDetail } from "@/features/statistics/utils/month-activity";

function dayCell(date: string, today: string, detail: DailyActivityDetail | null, flame = false) {
  const map = detail ? new Map([[date, detail]]) : new Map();
  const month = date.slice(0, 7);
  const days = calendarDays(month, map, today, flame ? [date] : []);
  return days.find((day) => day.date === date)!;
}

describe("CalendarDayCell", () => {
  const detail: DailyActivityDetail = {
    date: "2026-08-06",
    quizCount: 2,
    questions: 20,
    correct: 14,
  };

  it("reveals the same detail overlay on hover and focus without layout shift", () => {
    render(
      <CalendarDayCell
        day={dayCell("2026-08-06", "2026-08-31", detail)}
        today="2026-08-31"
        timezone="Asia/Ho_Chi_Minh"
      />,
    );

    const overlay = screen.getByRole("dialog", { name: "Chi tiết hoạt động" });
    expect(overlay).toHaveTextContent("2 bài kiểm tra · 20 câu");
    expect(overlay).toHaveTextContent("14 câu đúng · Độ chính xác 70%");
    expect(overlay).toHaveClass(
      "group-hover:opacity-100",
      "group-focus-within:opacity-100",
      "pointer-events-none",
    );
  });

  it("renders a flame label for a streak day and a plain dot otherwise", () => {
    const flame = render(
      <CalendarDayCell
        day={dayCell("2026-08-06", "2026-08-31", detail, true)}
        today="2026-08-31"
        timezone="Asia/Ho_Chi_Minh"
      />,
    );
    expect(flame.getByRole("button", { name: /thuộc chuỗi học tập/ })).toBeInTheDocument();

    const plain = render(
      <CalendarDayCell
        day={dayCell("2026-08-06", "2026-08-31", detail, false)}
        today="2026-08-31"
        timezone="Asia/Ho_Chi_Minh"
      />,
    );
    expect(plain.getByRole("button", { name: /có hoạt động$/ })).toBeInTheDocument();
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
