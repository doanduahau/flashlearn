import { expect, test, type Page } from "@playwright/test";

import { signUpAndConfirm, TEST_PASSWORD, uniqueEmail } from "./support/auth-helpers";
import { authSubject, localSupabaseAdminRest } from "./support/supabase-api";

const QUIZ_CSV = "tests/fixtures/quiz-cards.csv";
const DAY_CELL = 'button[aria-haspopup="dialog"]:not([disabled])';
/** Desktop portal tooltip rendered to body */
const DAY_DETAIL_PORTAL = "[data-calendar-day-detail]";
/** Mobile inline detail still uses role=dialog */
const DAY_DETAIL_INLINE = 'span[role="dialog"][aria-label="Chi tiết hoạt động"]';

async function completeTenQuestionQuiz(page: Page): Promise<void> {
  await page.goto("/import");
  await page.getByLabel(/CSV\/XLSX/i).setInputFiles(QUIZ_CSV);
  await page.getByLabel("Tên bộ").fill("Bộ lịch hoạt động");
  await page.getByRole("button", { name: /Tạo bộ flashcard/i }).click();
  await expect(page).toHaveURL(/\/sets\/[0-9a-f-]+$/);

  await page.goto("/quiz");
  await expect(page.getByText("10 thẻ hợp lệ").filter({ visible: true })).toBeVisible();
  await page.getByRole("button", { name: "Bắt đầu kiểm tra" }).click();
  await expect(page).toHaveURL(/\/quiz\/[0-9a-f-]+$/);

  let previousPrompt = "";
  for (let index = 0; index < 10; index += 1) {
    const heading = page.getByRole("heading", { level: 1 });
    if (index > 0) {
      await expect(heading).not.toHaveText(previousPrompt);
    }
    previousPrompt = (await heading.textContent()) ?? "";

    await page.getByRole("radio").first().check();
    await page.getByRole("button", { name: "Xác nhận đáp án" }).click();
    // A correct answer auto-advances; an incorrect answer exposes a
    // "Câu tiếp theo"/"Xem kết quả" action. Wait for either outcome.
    const nextButton = page.getByRole("button", { name: /Câu tiếp theo|Xem kết quả/ });
    await expect
      .poll(
        async () => {
          const current = (await heading.textContent()) ?? "";
          const nextCount = await nextButton.count();
          return current !== previousPrompt || nextCount > 0;
        },
        { timeout: 5000 },
      )
      .toBe(true);
    if ((await nextButton.count()) > 0) {
      await nextButton.click();
    }
  }
  await expect(page).toHaveURL(/\/quiz\/[0-9a-f-]+\/result$/);
}

test.describe("Activity calendar interactions", () => {
  test("fine pointer: hover shows the detail, leaving hides it, focus shows it again", async ({
    page,
  }) => {
    await signUpAndConfirm(page, uniqueEmail("calendar_fine"));
    await completeTenQuestionQuiz(page);

    await page.goto("/profile?tab=statistics");
    const cell = page.locator(DAY_CELL).first();
    await expect(cell).toBeVisible();

    // Hover → detail appears via portal (rendered to body, not inside cell)
    await cell.hover();
    const portal = page.locator(DAY_DETAIL_PORTAL);
    await expect(portal).toBeVisible();

    // Mouse leave → detail disappears
    await page.mouse.move(0, 0);
    await expect(portal).toBeHidden();

    // Keyboard focus → detail appears again
    await cell.focus();
    await expect(portal).toBeVisible();

    // Blur → detail disappears
    await page.keyboard.press("Tab");
    await expect(portal).toBeHidden();
  });

  test("fine pointer: click does not create persistent open state", async ({ page }) => {
    await signUpAndConfirm(page, uniqueEmail("calendar_click"));
    await completeTenQuestionQuiz(page);

    await page.goto("/profile?tab=statistics");
    const cell = page.locator(DAY_CELL).first();
    await expect(cell).toBeVisible();

    // Click the day cell
    await cell.click();

    // Move pointer away from cell
    await page.mouse.move(0, 0);

    // No persistent portal should remain
    await expect(page.locator(DAY_DETAIL_PORTAL)).toBeHidden();
  });

  test("fine pointer: popup is topmost over overlapping calendar rows (elementFromPoint)", async ({
    page,
  }) => {
    await signUpAndConfirm(page, uniqueEmail("calendar_topmost"));
    await completeTenQuestionQuiz(page);

    await page.goto("/profile?tab=statistics");

    const cell = page.locator(DAY_CELL).first();
    await expect(cell).toBeVisible();

    await cell.hover();
    const portal = page.locator(DAY_DETAIL_PORTAL);
    await expect(portal).toBeVisible();

    const portalBox = await portal.boundingBox();
    expect(portalBox).not.toBeNull();
    if (!portalBox) throw new Error("Portal bounding box is null");

    const sampleX = portalBox.x + portalBox.width / 2;
    const sampleY = portalBox.y + portalBox.height / 2;

    // The portal has pointer-events:none so elementFromPoint/elementsFromPoint skip it.
    // To prove visual layering we use two complementary assertions:
    //
    // 1. The portal's computed z-index is 50 and its position is fixed — placing it in
    //    the root stacking context with a z-index that is higher than any calendar cell
    //    (which has no explicit z-index and is position:relative inside the grid).
    //
    // 2. Temporarily override pointer-events to "auto" on the portal so that
    //    elementFromPoint CAN return it, then verify it IS the topmost element at the
    //    sample point that overlaps the calendar row region below.
    const stacking = await page.evaluate(
      ({ x, y }: { x: number; y: number }) => {
        const portal = document.querySelector("[data-calendar-day-detail]");
        if (!portal) return null;

        const style = getComputedStyle(portal);

        // Temporarily enable pointer events to allow elementFromPoint to find portal
        (portal as HTMLElement).style.pointerEvents = "auto";
        const topEl = document.elementFromPoint(x, y);
        (portal as HTMLElement).style.pointerEvents = "";

        let topmostIsPortal = false;
        let current: Element | null = topEl;
        while (current) {
          if (current.hasAttribute("data-calendar-day-detail")) {
            topmostIsPortal = true;
            break;
          }
          current = current.parentElement;
        }

        return {
          zIndex: style.zIndex,
          position: style.position,
          parentIsBody: portal.parentElement === document.body,
          topmostIsPortal,
        };
      },
      { x: sampleX, y: sampleY },
    );

    expect(stacking).not.toBeNull();
    if (!stacking) throw new Error("Stacking info is null");

    // z-index must be 50 (Tailwind z-50)
    expect(stacking.zIndex).toBe("50");
    // Must be fixed-positioned (in the root stacking context, above grid)
    expect(stacking.position).toBe("fixed");
    // Must be a direct child of body (escaped the calendar grid completely)
    expect(stacking.parentIsBody).toBe(true);
    // With pointer-events temporarily restored, must be the topmost element
    expect(stacking.topmostIsPortal).toBe(true);
  });

  test("fine pointer: popup is not clipped by calendar card container", async ({ page }) => {
    await signUpAndConfirm(page, uniqueEmail("calendar_clip"));
    await completeTenQuestionQuiz(page);

    await page.goto("/profile?tab=statistics");

    const cell = page.locator(DAY_CELL).first();
    await expect(cell).toBeVisible();
    await cell.hover();

    const portal = page.locator(DAY_DETAIL_PORTAL);
    await expect(portal).toBeVisible();

    // The portal is rendered to document.body, so its parent should NOT be
    // inside the calendar card. Verify that the portal's parent is document.body.
    const parentIsDomBody = await portal.evaluate((el) => el.parentElement === document.body);
    expect(parentIsDomBody).toBe(true);
  });

  test("fine pointer: edge date popup stays within viewport", async ({ page }) => {
    await signUpAndConfirm(page, uniqueEmail("calendar_edge"));
    await completeTenQuestionQuiz(page);

    await page.goto("/profile?tab=statistics");

    // Hover the last active day cell (likely near the right edge of the calendar)
    const cells = page.locator(DAY_CELL);
    const cellCount = await cells.count();
    const lastCell = cells.nth(cellCount - 1);
    await expect(lastCell).toBeVisible();
    await lastCell.hover();

    const portal = page.locator(DAY_DETAIL_PORTAL);
    await expect(portal).toBeVisible();

    const portalBox = await portal.boundingBox();
    const viewportSize = page.viewportSize();
    expect(portalBox).not.toBeNull();
    expect(viewportSize).not.toBeNull();

    if (!portalBox || !viewportSize) throw new Error("Missing bounding box or viewport size");

    // Popup must not overflow viewport right or bottom edges
    expect(portalBox.x).toBeGreaterThanOrEqual(0);
    expect(portalBox.x + portalBox.width).toBeLessThanOrEqual(viewportSize.width);
  });

  test("coarse pointer: tapping a day opens its detail and tapping outside closes it", async ({
    browser,
  }) => {
    const desktop = await browser.newContext();
    const page = await desktop.newPage();
    const email = uniqueEmail("calendar_coarse");
    await signUpAndConfirm(page, email);
    await completeTenQuestionQuiz(page);
    const userId = await authSubject(desktop);

    // Seed an active Sunday in the current test month. This makes the mobile
    // interaction exercise a real rightmost calendar column, rather than only
    // asserting the bottom navigation after an unopened calendar.
    const seededDay = "2026-08-09";
    const seededActivity = await localSupabaseAdminRest("daily_learning_records", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        user_id: userId,
        local_date: seededDay,
        timezone: "Asia/Ho_Chi_Minh",
        completed_quiz_count: 1,
        questions_answered: 1,
        correct_answers: 1,
        first_completed_at: "2026-08-09T12:00:00.000Z",
        last_completed_at: "2026-08-09T12:00:00.000Z",
      }),
    });
    expect(seededActivity.ok).toBe(true);

    const mobile = await browser.newContext({
      hasTouch: true,
      viewport: { width: 390, height: 844 },
    });
    await mobile.addInitScript(() => {
      const original = window.matchMedia.bind(window);
      window.matchMedia = (query: string): MediaQueryList => {
        const match = original(query);
        if (!query.includes("pointer")) return match;
        const matches = query.includes("coarse");
        return {
          get matches() {
            return matches;
          },
          media: query,
          onchange: null,
          addEventListener: (...args: Parameters<MediaQueryList["addEventListener"]>) =>
            match.addEventListener(...args),
          removeEventListener: (...args: Parameters<MediaQueryList["removeEventListener"]>) =>
            match.removeEventListener(...args),
          addListener: (...args: Parameters<MediaQueryList["addListener"]>) =>
            match.addListener(...args),
          removeListener: (...args: Parameters<MediaQueryList["removeListener"]>) =>
            match.removeListener(...args),
          dispatchEvent: (event: Event) => match.dispatchEvent(event),
        };
      };
    });
    const mpage = await mobile.newPage();
    await mpage.goto("/sign-in");
    await mpage.getByLabel("Email").fill(email);
    await mpage.getByRole("textbox", { name: "Mật khẩu" }).fill(TEST_PASSWORD);
    await mpage.getByRole("button", { name: /Đăng nhập/ }).click();
    await expect(mpage).toHaveURL(/\/dashboard$/);

    // Reproduce the reported path: a normal app page -> the actual bottom
    // navigation's Dashboard link. Record every animation frame so a brief
    // route-transition overflow or nav unmount cannot be hidden by a final
    // settled-state assertion.
    await mpage.goto("/sets");
    const navigation = mpage.getByRole("navigation", { name: "Điều hướng chính" }).last();
    await expect(navigation).toBeVisible();
    const initialNavigationBox = await navigation.boundingBox();
    const initialRightmostNavItemBox = await navigation
      .getByRole("link", { name: "Cá nhân" })
      .boundingBox();
    const initialViewport = mpage.viewportSize();
    expect(initialNavigationBox).not.toBeNull();
    expect(initialRightmostNavItemBox).not.toBeNull();
    expect(initialViewport).not.toBeNull();
    if (!initialNavigationBox || !initialRightmostNavItemBox || !initialViewport) {
      throw new Error("Missing initial mobile navigation geometry");
    }
    expect(initialNavigationBox.x).toBeGreaterThanOrEqual(0);
    expect(initialNavigationBox.x + initialNavigationBox.width).toBeLessThanOrEqual(
      initialViewport.width,
    );
    expect(initialRightmostNavItemBox.x).toBeGreaterThanOrEqual(0);
    expect(initialRightmostNavItemBox.x + initialRightmostNavItemBox.width).toBeLessThanOrEqual(
      initialViewport.width,
    );
    expect(
      await mpage.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
    await navigation.evaluate((element) => {
      const nav = element as HTMLElement;
      nav.dataset.dashboardTransitionProbe = "active";

      const samples: Array<{
        connected: boolean;
        display: string;
        visibility: string;
        scrollWidth: number;
        clientWidth: number;
      }> = [];
      const record = (): void => {
        const style = getComputedStyle(nav);
        samples.push({
          connected: nav.isConnected,
          display: style.display,
          visibility: style.visibility,
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        });
      };
      const state = {
        animationFrame: 0,
        observer: new MutationObserver(record),
        samples,
      };
      state.observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class", "style", "hidden"],
        childList: true,
        subtree: true,
      });
      const sampleFrame = (): void => {
        record();
        state.animationFrame = requestAnimationFrame(sampleFrame);
      };
      record();
      state.animationFrame = requestAnimationFrame(sampleFrame);
      (
        window as typeof window & { __dashboardTransitionProbe?: typeof state }
      ).__dashboardTransitionProbe = state;
    });

    await navigation.getByRole("link", { name: "Tổng quan" }).tap();
    await expect(mpage).toHaveURL(/\/dashboard$/);
    const cell = mpage.locator(DAY_CELL).filter({ has: mpage.getByText("9", { exact: true }) });
    await expect(cell).toBeVisible();

    const transition = await mpage.evaluate(() => {
      const state = (
        window as typeof window & {
          __dashboardTransitionProbe?: {
            animationFrame: number;
            observer: MutationObserver;
            samples: Array<{
              connected: boolean;
              display: string;
              visibility: string;
              scrollWidth: number;
              clientWidth: number;
            }>;
          };
        }
      ).__dashboardTransitionProbe;
      if (!state) throw new Error("Dashboard transition probe was not initialized");
      cancelAnimationFrame(state.animationFrame);
      state.observer.disconnect();
      return state.samples;
    });
    expect(transition.length).toBeGreaterThan(0);
    expect(transition.every((sample) => sample.connected)).toBe(true);
    expect(transition.every((sample) => sample.display !== "none")).toBe(true);
    expect(transition.every((sample) => sample.visibility !== "hidden")).toBe(true);
    expect(transition.every((sample) => sample.scrollWidth <= sample.clientWidth)).toBe(true);
    expect(
      await mpage.evaluate(() => document.body.scrollWidth <= document.documentElement.clientWidth),
    ).toBe(true);

    const rightmostNavItem = navigation.getByRole("link", { name: "Cá nhân" });
    await expect(rightmostNavItem).toBeVisible();
    for (const label of ["Tổng quan", "Bộ flashcard", "Học", "Kiểm tra", "Cá nhân"]) {
      await expect(navigation.getByRole("link", { name: label })).toBeVisible();
    }
    const navigationBoxAfterTransition = await navigation.boundingBox();
    const rightmostNavItemBox = await rightmostNavItem.boundingBox();
    const transitionViewport = mpage.viewportSize();
    expect(navigationBoxAfterTransition).not.toBeNull();
    expect(rightmostNavItemBox).not.toBeNull();
    expect(transitionViewport).not.toBeNull();
    if (!navigationBoxAfterTransition || !rightmostNavItemBox || !transitionViewport) {
      throw new Error("Missing mobile navigation geometry after Dashboard transition");
    }
    expect(navigationBoxAfterTransition.x).toBeGreaterThanOrEqual(0);
    expect(navigationBoxAfterTransition.x + navigationBoxAfterTransition.width).toBeLessThanOrEqual(
      transitionViewport.width,
    );
    expect(rightmostNavItemBox.x).toBeGreaterThanOrEqual(0);
    expect(rightmostNavItemBox.x + rightmostNavItemBox.width).toBeLessThanOrEqual(
      transitionViewport.width,
    );

    const cellBox = await cell.boundingBox();
    const viewport = mpage.viewportSize();
    expect(cellBox).not.toBeNull();
    expect(viewport).not.toBeNull();
    if (!cellBox || !viewport) throw new Error("Missing mobile calendar geometry");
    expect(cellBox.x + cellBox.width / 2).toBeGreaterThan(viewport.width * 0.8);

    // Mobile Dashboard: tap the rightmost active cell and prove the actual
    // inline dialog and fixed bottom navigation remain inside the viewport.
    await cell.tap();
    const detail = cell.locator(DAY_DETAIL_INLINE);
    await expect(detail).toBeVisible();
    const detailBox = await detail.boundingBox();
    expect(detailBox).not.toBeNull();
    if (!detailBox) throw new Error("Missing mobile day-detail geometry");
    expect(detailBox.x).toBeGreaterThanOrEqual(0);
    expect(detailBox.x + detailBox.width).toBeLessThanOrEqual(viewport.width);
    expect(
      await mpage.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
    const navigationBox = await navigation.boundingBox();
    expect(navigationBox).not.toBeNull();
    if (!navigationBox) throw new Error("Missing bottom navigation geometry");
    expect(navigationBox.x).toBeGreaterThanOrEqual(0);
    expect(navigationBox.x + navigationBox.width).toBeLessThanOrEqual(viewport.width);

    // Tapping outside closes it
    await mpage.getByRole("heading", { level: 1 }).tap();
    await expect(cell.locator(DAY_DETAIL_INLINE)).toBeHidden();

    // Compare a second normal app-to-app transition after Dashboard.
    await navigation.getByRole("link", { name: "Bộ flashcard" }).tap();
    await expect(mpage).toHaveURL(/\/sets$/);
    expect(
      await mpage.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
    const setsNavigationBox = await navigation.boundingBox();
    expect(setsNavigationBox).not.toBeNull();
    if (!setsNavigationBox) throw new Error("Missing navigation geometry after normal transition");
    expect(setsNavigationBox.x).toBeGreaterThanOrEqual(0);
    expect(setsNavigationBox.x + setsNavigationBox.width).toBeLessThanOrEqual(viewport.width);
  });
});
