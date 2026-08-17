import { expect, type Page, test } from "@playwright/test";

import { signUpAndConfirm, uniqueEmail } from "./support/auth-helpers";

const IMPORT_CSV = "tests/fixtures/set-management.csv";
const SET_NAME = "Bộ offline";

async function importSet(page: Page): Promise<string> {
  await page.goto("/sets/create?source=file");
  await page.getByLabel(/CSV\/XLSX/i).setInputFiles(IMPORT_CSV);
  await page.getByRole("button", { name: "Phân tích" }).click();
  await page.getByLabel("Tên bộ").fill(SET_NAME);
  await page.getByRole("button", { name: /Tạo bộ flashcard/i }).click();
  await expect(page).toHaveURL(/\/sets\/[0-9a-f-]+$/);
  return new URL(page.url()).pathname.split("/").pop() ?? "";
}

async function waitForServiceWorker(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      if (!("serviceWorker" in navigator)) return false;
      return Boolean(navigator.serviceWorker.controller);
    },
    null,
    { timeout: 15_000 },
  );
}

test.describe("PWA offline reading", () => {
  test("cached pages stay readable offline with a banner", async ({ page, context }) => {
    await signUpAndConfirm(page, uniqueEmail("pwa_offline"));

    const setId = await importSet(page);

    // A freshly-registered service worker only controls the next navigation,
    // so reload once so subsequent visits are intercepted and cached.
    await page.reload();
    await waitForServiceWorker(page);

    // Visit each read page online so the SW caches their HTML.
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Tổng quan" })).toBeVisible();
    await page.goto("/sets");
    await expect(page.getByRole("heading", { name: "Bộ flashcard" })).toBeVisible();
    await page.goto("/sets/library");
    await expect(page.getByRole("heading", { name: "Flash card của bạn" })).toBeVisible();
    await page.goto(`/sets/${setId}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(SET_NAME);

    // Going offline on the live page flips navigator.onLine and shows the banner.
    await page.goto("/dashboard");
    await context.setOffline(true);
    await expect(page.getByText(/Bạn đang offline/)).toBeVisible();

    // Reload the cached dashboard: it still renders while offline.
    await page.reload();
    await expect(page.getByRole("heading", { name: "Tổng quan" })).toBeVisible();

    // A visited set detail page still renders offline.
    await page.goto(`/sets/${setId}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(SET_NAME);

    // A route never cached (e.g. /collections) falls back to the offline shell.
    await page.goto("/collections");
    await expect(page.getByRole("heading", { name: "Bạn đang offline" })).toBeVisible();

    // Coming back online hides the banner.
    await context.setOffline(false);
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Tổng quan" })).toBeVisible();
    await expect(page.getByText(/Bạn đang offline/)).toHaveCount(0);
  });
});
