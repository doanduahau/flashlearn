import { expect, type Page, test } from "@playwright/test";

import { signUpAndConfirm, uniqueEmail } from "./support/auth-helpers";

const MOBILE = { width: 390, height: 844 };
const CSV = "tests/fixtures/smart-review-24-cards.csv";

async function startRunnerSession(page: Page): Promise<void> {
  await page.goto("/sets/create?source=file");
  await page.getByLabel(/CSV\/XLSX/i).setInputFiles(CSV);
  await page.getByRole("button", { name: "Phân tích" }).click();
  await page.getByLabel("Tên bộ").fill("Bộ Runner game");
  await page.getByRole("button", { name: /Tạo bộ flashcard/i }).click();
  await expect(page).toHaveURL(/\/sets\/[0-9a-f-]+$/);

  await page.goto("/runner");
  await expect(page.getByRole("button", { name: "Bắt đầu Runner" })).toBeEnabled();
  await page.getByRole("button", { name: "Bắt đầu Runner" }).click();
  await expect(page).toHaveURL(/\/runner\/session\?sessionId=[0-9a-f-]+/);
  const params = new URL(page.url()).searchParams;
  expect(params.get("all")).toBe("1");
  expect(params.get("count")).toBe("12");
  expect(params.get("filter")).toBeNull();
  expect(params.get("difficulty")).toBe("medium");
}

test.describe("Capy Runner gameplay session", () => {
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

  test("back arrow returns to the previous page", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await signUpAndConfirm(page, uniqueEmail("runner_game_exit"));
    await startRunnerSession(page);

    // Start the game so the start overlay does not intercept the HUD.
    await page.getByRole("button", { name: "Chạm để bắt đầu" }).click();
    await expect(page.getByText("Chạm để bắt đầu")).toHaveCount(0);

    // Hủy keeps the learner in the session.
    await page.getByRole("button", { name: "Thoát phiên học" }).click();
    await expect(page.getByRole("dialog", { name: "Thoát phiên?" })).toBeVisible();
    await page.getByRole("button", { name: "Hủy" }).click();
    await expect(page).toHaveURL(/\/runner\/session\?sessionId=/);

    // Confirmed exit returns to the previous page.
    await page.getByRole("button", { name: "Thoát phiên học" }).click();
    await page.getByRole("button", { name: "Thoát", exact: true }).click();
    await expect(page).toHaveURL(/\/runner$/);
  });

  test("browser back returns to the setup page", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await signUpAndConfirm(page, uniqueEmail("runner_game_back"));
    await startRunnerSession(page);

    await page.goBack();
    await expect(page).toHaveURL(/\/runner$/);
  });
});
