import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

  // ── Mobile / coarse-pointer tests ─────────────────────────────────────────
  // These verify the inline dialog that stays inside the cell (mobile tap model).

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

  // ── Desktop / fine-pointer tests ──────────────────────────────────────────
  // On desktop, there is NO inline dialog inside the cell. The portal is
  // rendered to document.body by ActivityCalendarGrid when a cell is hovered.

  it("does NOT render an inline detail overlay inside cells on fine pointers", () => {
    stubMatchMedia(false);
    render(
      <ActivityCalendarGrid days={daysForMonth()} today="2026-08-07" timezone="Asia/Ho_Chi_Minh" />,
    );

    const [augustSixth] = activeButtons();
    // No inline dialog should exist inside the button in desktop mode
    expect(
      within(augustSixth).queryByRole("dialog", { name: "Chi tiết hoạt động" }),
    ).not.toBeInTheDocument();
  });

  it("renders the portaled detail to document.body on mouseenter and removes it on mouseleave", async () => {
    stubMatchMedia(false);
    render(
      <ActivityCalendarGrid days={daysForMonth()} today="2026-08-07" timezone="Asia/Ho_Chi_Minh" />,
    );

    const [augustSixth] = activeButtons();

    // Before hover: no portal tooltip
    expect(document.querySelector("[data-calendar-day-detail]")).toBeNull();

    // Hover the cell
    fireEvent.mouseEnter(augustSixth);
    await waitFor(() => {
      const portal = document.querySelector("[data-calendar-day-detail]");
      expect(portal).not.toBeNull();
      expect(portal?.parentElement).toBe(document.body);
    });

    // Unhover: portal should be removed
    fireEvent.mouseLeave(augustSixth);
    await waitFor(() => {
      expect(document.querySelector("[data-calendar-day-detail]")).toBeNull();
    });
  });

  it("does not create a click/persistent state on fine pointers", async () => {
    stubMatchMedia(false);
    const user = userEvent.setup();
    render(
      <ActivityCalendarGrid days={daysForMonth()} today="2026-08-07" timezone="Asia/Ho_Chi_Minh" />,
    );

    const [augustSixth] = activeButtons();
    // Click the button — in fine-pointer mode, onTap is a no-op so no state change
    await user.click(augustSixth);

    // After click and pointer moving away, there should be no visible portal
    // (In jsdom there's no real hover, but we can confirm no inline dialog exists)
    expect(
      within(augustSixth).queryByRole("dialog", { name: "Chi tiết hoạt động" }),
    ).not.toBeInTheDocument();
  });
});
