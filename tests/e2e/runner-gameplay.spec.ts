import { expect, type Page, test } from "@playwright/test";

import { signUpAndConfirm, uniqueEmail } from "./support/auth-helpers";

const MOBILE = { width: 390, height: 844 };
const CSV = "tests/fixtures/smart-review-24-cards.csv";

async function startRunnerSession(page: Page): Promise<void> {
  await page.goto("/import");
  await page.getByLabel(/CSV\/XLSX/i).setInputFiles(CSV);
  await page.getByLabel("Tên bộ").fill("Bộ Runner game");
  await page.getByRole("button", { name: /Tạo bộ flashcard/i }).click();
  await expect(page).toHaveURL(/\/sets\/[0-9a-f-]+$/);

  await page.goto("/runner");
  await expect(page.getByRole("button", { name: "Bắt đầu Runner" })).toBeEnabled();
  await page.getByRole("button", { name: "Bắt đầu Runner" }).click();
  await expect(page).toHaveURL(/\/runner\/session\?sessionId=[0-9a-f-]+/);
}

test.describe("Flashcard Runner gameplay session", () => {
  test("renders the canvas, HUD and start overlay", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await signUpAndConfirm(page, uniqueEmail("runner_game_hud"));
    await startRunnerSession(page);

    await expect(page.locator("canvas")).toBeVisible();
    await expect(page.getByText("Câu 1 / 12")).toBeVisible();
    await expect(page.getByRole("img", { name: "2 mạng" })).toBeVisible();
    await expect(page.getByText("Chạm để bắt đầu")).toBeVisible();
    await expect(page.getByLabel("Thời gian")).toHaveText("00:00");
  });

  test("starts on tap and the timer counts up", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await signUpAndConfirm(page, uniqueEmail("runner_game_timer"));
    await startRunnerSession(page);

    await page.getByRole("button", { name: "Chạm để bắt đầu" }).click();
    await expect(page.getByText("Chạm để bắt đầu")).toHaveCount(0);
    await expect(page.getByLabel("Thời gian")).toHaveText("00:01", { timeout: 5000 });
  });

  test("hides app chrome on the session page", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await signUpAndConfirm(page, uniqueEmail("runner_game_chrome"));
    await startRunnerSession(page);

    await expect(page.locator("nav")).toHaveCount(0);
    await expect(page.locator("header")).toHaveCount(0);
  });

  test("has no horizontal overflow at 390px", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await signUpAndConfirm(page, uniqueEmail("runner_game_overflow"));
    await startRunnerSession(page);

    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasOverflow).toBe(false);
  });

  test("browser back returns to the setup page", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await signUpAndConfirm(page, uniqueEmail("runner_game_back"));
    await startRunnerSession(page);

    await page.goBack();
    await expect(page).toHaveURL(/\/runner$/);
  });
});
