import { expect, test } from "@playwright/test";

import { signUpAndConfirm, uniqueEmail } from "./support/auth-helpers";

const MOBILE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 800 };

/**
 * Creates 13 regular flashcard sets and 1 special collection for a user,
 * each with at least 1 card so quiz can start.
 */
async function seedSetsForQuiz(page: import("@playwright/test").Page, count = 13): Promise<void> {
  for (let i = 1; i <= count; i++) {
    await page.goto("/sets?create=manual");
    await page.getByLabel("Tên bộ").fill(`Bộ quiz ${i}`);
    await page.getByLabel("Mặt trước").fill(`Trước ${i}`);
    await page.getByLabel("Mặt sau").fill(`Sau ${i}`);
    await page.getByRole("button", { name: "Tạo bộ" }).click();
    await expect(page).toHaveURL(/\/sets\/[0-9a-f-]+$/);
  }
}

test.describe("Mobile-first UI — Dashboard", () => {
  test("monthly calendar starts within early viewport on mobile", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await signUpAndConfirm(page, uniqueEmail("dash_cal"));

    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // Monthly calendar section should be visible without excessive scrolling
    const calendar = page
      .getByRole("heading", { name: /Ho\u1ea1t \u0111\u1ed9ng th\u00e1ng n\u00e0y/ })
      .first();
    await expect(calendar).toBeVisible();

    // Top of the calendar heading should appear in the top half of the viewport
    const box = await calendar.boundingBox();
    expect(box).not.toBeNull();
    // Should appear within 500px from top of the scrolled page (i.e. not requiring much scroll)
    // We check its Y relative to page: it should be within first ~2/3 of 844px viewport
    const scrollY = await page.evaluate(() => window.scrollY);
    expect((box?.y ?? 0) + scrollY).toBeLessThan(560);

    // No horizontal scroll
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
  });

  test("dashboard layout remains healthy on desktop", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await signUpAndConfirm(page, uniqueEmail("dash_desk"));
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Ho\u1ea1t \u0111\u1ed9ng th\u00e1ng n\u00e0y/ }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
  });
});

test.describe("Mobile-first UI — Sets page", () => {
  test("set list begins high on screen with compact create area on mobile", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await signUpAndConfirm(page, uniqueEmail("sets_mob"));

    // Create one set so list is non-empty
    await page.goto("/sets?create=manual");
    await page.getByLabel("Tên bộ").fill("Test Set");
    await page.getByLabel("Mặt trước").fill("Trước");
    await page.getByLabel("Mặt sau").fill("Sau");
    await page.getByRole("button", { name: "Tạo bộ" }).click();
    await expect(page).toHaveURL(/\/sets\/[0-9a-f-]+$/);

    await page.goto("/sets");

    // Create buttons visible
    const importLink = page.getByRole("link", { name: /Nh\u1eadp Excel/ });
    const pasteLink = page.getByRole("link", { name: /D\u00e1n n\u1ed9i dung/ });
    const manualLink = page.getByRole("link", { name: /Th\u1ee7 c\u00f4ng/ });
    await expect(importLink).toBeVisible();
    await expect(pasteLink).toBeVisible();
    await expect(manualLink).toBeVisible();

    // Create buttons share consistent height
    const importBox = await importLink.boundingBox();
    const manualBox = await manualLink.boundingBox();
    expect(importBox).not.toBeNull();
    expect(manualBox).not.toBeNull();
    expect(Math.abs((importBox?.height ?? 0) - (manualBox?.height ?? 0))).toBeLessThan(2);

    // No horizontal overflow at mobile width
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);

    // "Tạo bộ" label is centered above the button group
    const createLabel = page.getByText("T\u1ea1o b\u1ed9", { exact: true }).first();
    await expect(createLabel).toBeVisible();
    const labelBox = await createLabel.boundingBox();
    expect(labelBox).not.toBeNull();
    const groupCenter =
      (Math.min(importBox?.x ?? 0, manualBox?.x ?? 0) +
        Math.max(
          (importBox?.x ?? 0) + (importBox?.width ?? 0),
          (manualBox?.x ?? 0) + (manualBox?.width ?? 0),
        )) /
      2;
    const labelCenter = (labelBox?.x ?? 0) + (labelBox?.width ?? 0) / 2;
    expect(Math.abs(labelCenter - groupCenter)).toBeLessThan(50);

    // Sets list (tab content) should appear — first set card within reasonable screen area
    const firstCard = page.getByRole("link", { name: /Test Set/ }).first();
    await expect(firstCard).toBeVisible();
    const box = await firstCard.boundingBox();
    expect(box).not.toBeNull();
    // First set card should be in the first 2/3 of the 844px viewport without scrolling
    expect(box?.y ?? 0).toBeLessThan(580);

    // No horizontal scroll
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
  });

  test("sets page desktop layout is unchanged", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await signUpAndConfirm(page, uniqueEmail("sets_desk"));
    await page.goto("/sets");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
  });
});

test.describe("Mobile-first UI — Study page", () => {
  test("study source list is primary visible content on mobile", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await signUpAndConfirm(page, uniqueEmail("study_mob"));

    await page.goto("/sets?create=manual");
    await page.getByLabel("Tên bộ").fill("Học thử");
    await page.getByLabel("Mặt trước").fill("Q");
    await page.getByLabel("Mặt sau").fill("A");
    await page.getByRole("button", { name: "Tạo bộ" }).click();
    await expect(page).toHaveURL(/\/sets\/[0-9a-f-]+$/);

    await page.goto("/study");

    // Source browser heading visible without scrolling
    const heading = page.getByRole("heading", { name: /Ch\u1ecdn ngu\u1ed3n/ });
    await expect(heading).toBeVisible();

    // "Bắt đầu học" button in sticky bar visible
    const startBtn = page.getByRole("button", { name: /B\u1eaft \u0111\u1ea7u h\u1ecdc/ });
    await expect(startBtn).toBeVisible();
    const box = await startBtn.boundingBox();
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(MOBILE.height);

    // No horizontal scroll
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
  });

  test("no bottom nav overlap with sticky study action bar", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await signUpAndConfirm(page, uniqueEmail("study_overlap"));

    await page.goto("/sets?create=manual");
    await page.getByLabel("Tên bộ").fill("Học thử 2");
    await page.getByLabel("Mặt trước").fill("Q");
    await page.getByLabel("Mặt sau").fill("A");
    await page.getByRole("button", { name: "Tạo bộ" }).click();
    await expect(page).toHaveURL(/\/sets\/[0-9a-f-]+$/);

    await page.goto("/study");

    const startBtn = page.getByRole("button", { name: /B\u1eaft \u0111\u1ea7u h\u1ecdc/ });
    const nav = page.getByRole("navigation", { name: /\u0110i\u1ec1u h\u01b0\u1edbng ch\u00ednh/ });

    const btnBox = await startBtn.boundingBox();
    const navBox = await nav.boundingBox();

    // Action bar button should not overlap with bottom navigation
    if (btnBox && navBox) {
      const btnBottom = btnBox.y + btnBox.height;
      expect(btnBottom).toBeLessThanOrEqual(navBox.y + 4); // 4px tolerance
    }
  });
});

test.describe("Mobile-first UI — Quiz page", () => {
  test("quiz mode and count reachable via action bar while scrolled deep in source list", async ({
    page,
  }) => {
    await page.setViewportSize(MOBILE);
    await signUpAndConfirm(page, uniqueEmail("quiz_config"));
    await seedSetsForQuiz(page);

    await page.goto("/quiz?tab=create");

    // Scroll deep into source list (to bottom)
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    // "Bắt đầu kiểm tra" button must still be visible in sticky bar
    const startBtn = page.getByRole("button", { name: /B\u1eaft \u0111\u1ea7u ki\u1ec3m tra/ });
    await expect(startBtn).toBeVisible();
    const startBox = await startBtn.boundingBox();
    expect((startBox?.y ?? 0) + (startBox?.height ?? 0)).toBeLessThanOrEqual(MOBILE.height);

    // "Thiết lập" config button visible in action bar
    const configBtn = page.getByRole("button", {
      name: /Thi\u1ebft l\u1eadp b\u00e0i ki\u1ec3m tra/,
    });
    await expect(configBtn).toBeVisible();

    // Opening bottom sheet shows mode chips
    await configBtn.click();
    const dialog = page.getByRole("dialog", { name: /Thi\u1ebft l\u1eadp b\u00e0i ki\u1ec3m tra/ });
    await expect(dialog).toBeVisible();

    // Mode chips all visible in bottom sheet
    await expect(dialog.getByRole("button", { name: "Cân bằng" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Chưa kiểm tra" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Câu sai" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Ngẫu nhiên" })).toBeVisible();

    // Select a mode
    await dialog.getByRole("button", { name: "Câu sai" }).click();

    // Count buttons visible
    await expect(dialog.getByRole("button", { name: "10" })).toBeVisible();
    await dialog.getByRole("button", { name: "10" }).click();

    // Close sheet
    await dialog.getByRole("button", { name: /Xong/ }).click();
    await expect(dialog).not.toBeVisible();

    // "Bắt đầu kiểm tra" still visible after sheet closed
    await expect(startBtn).toBeVisible();
  });

  test("quiz start button remains in viewport on mobile regardless of scroll position", async ({
    page,
  }) => {
    await page.setViewportSize(MOBILE);
    await signUpAndConfirm(page, uniqueEmail("quiz_start_vis"));
    await seedSetsForQuiz(page, 3);

    await page.goto("/quiz?tab=create");

    // Without scrolling
    const startBtn = page.getByRole("button", { name: /B\u1eaft \u0111\u1ea7u ki\u1ec3m tra/ });
    await expect(startBtn).toBeVisible();

    // After scrolling to bottom
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(startBtn).toBeVisible();
    const box = await startBtn.boundingBox();
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(MOBILE.height);
  });

  test("quiz action bar is contiguous with bottom nav and summarizes mode/count/cards", async ({
    page,
  }) => {
    await page.setViewportSize(MOBILE);
    await signUpAndConfirm(page, uniqueEmail("quiz_bar"));
    await seedSetsForQuiz(page);

    await page.goto("/quiz?tab=create");

    const startBtn = page.getByRole("button", { name: /B\u1eaft \u0111\u1ea7u ki\u1ec3m tra/ });
    await expect(startBtn).toBeVisible();

    // Action bar should sit directly above the bottom nav (no gap, no overlap)
    const bar = page.locator('div[class*="bottom-[calc"]').first();
    const nav = page.getByRole("navigation", { name: /\u0110i\u1ec1u h\u01b0\u1edbng ch\u00ednh/ });
    const barBox = await bar.boundingBox();
    const navBox = await nav.boundingBox();
    expect(barBox).not.toBeNull();
    expect(navBox).not.toBeNull();
    const barBottom = (barBox?.y ?? 0) + (barBox?.height ?? 0);
    expect(Math.abs(barBottom - (navBox?.y ?? 0))).toBeLessThanOrEqual(2);

    // Mode name is fully visible (not truncated)
    await expect(bar.getByText("C\u00e2n b\u1eb1ng", { exact: true })).toBeVisible();

    // Question count and eligible card count are fully visible (not truncated)
    await expect(bar.getByText("10 c\u00e2u \u00b7 13 th\u1ebb")).toBeVisible();

    // Start button stays above the bottom nav
    const startBox = await startBtn.boundingBox();
    expect(startBox).not.toBeNull();
    const startBottom = (startBox?.y ?? 0) + (startBox?.height ?? 0);
    expect(startBottom).toBeLessThanOrEqual((navBox?.y ?? 0) + 4);
  });

  test("quiz page desktop layout is unchanged", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await signUpAndConfirm(page, uniqueEmail("quiz_desk"));
    await page.goto("/quiz?tab=create");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // Desktop shows inline config (no bottom sheet trigger)
    await expect(
      page.getByRole("button", { name: /Thi\u1ebft l\u1eadp b\u00e0i ki\u1ec3m tra/ }),
    ).not.toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
  });

  test("no horizontal scroll on mobile in quiz page", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await signUpAndConfirm(page, uniqueEmail("quiz_hscroll"));
    await page.goto("/quiz?tab=create");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
  });
});
