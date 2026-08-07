import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ActivityCalendarGrid } from "@/features/statistics/components/activity-calendar-grid";
import { calendarDays, type DailyActivityDetail } from "@/features/statistics/utils/month-activity";

function stubMatchMedia(matches: boolean): void {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

function detail(date: string, quizCount: number): DailyActivityDetail {
  return { date, quizCount, questions: quizCount * 5, correct: quizCount * 4 };
}

function daysForMonth() {
  return calendarDays(
    "2026-08",
    new Map([
      ["2026-08-06", detail("2026-08-06", 1)],
      ["2026-08-07", detail("2026-08-07", 2)],
    ]),
    "2026-08-07",
    ["2026-08-07", "2026-08-06"],
  );
}

function activeButtons() {
  return screen.getAllByRole("button", { name: /(?<!không )có hoạt động/ });
}

function dialogOf(button: HTMLElement): HTMLElement {
  return within(button).getByRole("dialog", { name: "Chi tiết hoạt động" });
}

describe("ActivityCalendarGrid", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps details closed until a coarse-pointer tap opens one", async () => {
    stubMatchMedia(true);
    const user = userEvent.setup();
    render(
      <ActivityCalendarGrid days={daysForMonth()} today="2026-08-07" timezone="Asia/Ho_Chi_Minh" />,
    );

    const [augustSixth, augustSeventh] = activeButtons();
    expect(dialogOf(augustSixth)).not.toHaveClass("visible");
    expect(dialogOf(augustSeventh)).not.toHaveClass("visible");

    await user.click(augustSixth);
    expect(dialogOf(augustSixth)).toHaveClass("visible");
    expect(dialogOf(augustSeventh)).not.toHaveClass("visible");
  });

  it("switches to the tapped day and keeps only one open", async () => {
    stubMatchMedia(true);
    const user = userEvent.setup();
    render(
      <ActivityCalendarGrid days={daysForMonth()} today="2026-08-07" timezone="Asia/Ho_Chi_Minh" />,
    );

    const [augustSixth, augustSeventh] = activeButtons();
    await user.click(augustSixth);
    await user.click(augustSeventh);

    expect(dialogOf(augustSeventh)).toHaveClass("visible");
    expect(dialogOf(augustSixth)).not.toHaveClass("visible");
  });

  it("closes the open day when tapping outside or pressing Escape", async () => {
    stubMatchMedia(true);
    const user = userEvent.setup();
    render(
      <ActivityCalendarGrid days={daysForMonth()} today="2026-08-07" timezone="Asia/Ho_Chi_Minh" />,
    );

    const [augustSixth] = activeButtons();
    await user.click(augustSixth);
    expect(dialogOf(augustSixth)).toHaveClass("visible");

    fireEvent.pointerDown(document.body);
    expect(dialogOf(augustSixth)).not.toHaveClass("visible");

    await user.click(augustSixth);
    expect(dialogOf(augustSixth)).toHaveClass("visible");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(dialogOf(augustSixth)).not.toHaveClass("visible");
  });

  it("uses hover/focus CSS and no click state on fine pointers", async () => {
    stubMatchMedia(false);
    const user = userEvent.setup();
    render(
      <ActivityCalendarGrid days={daysForMonth()} today="2026-08-07" timezone="Asia/Ho_Chi_Minh" />,
    );

    const [augustSixth] = activeButtons();
    await user.click(augustSixth);

    const overlay = dialogOf(augustSixth);
    expect(overlay).toHaveClass("group-hover:opacity-100", "group-focus-within:opacity-100");
    expect(overlay).not.toHaveClass("visible");
  });
});
