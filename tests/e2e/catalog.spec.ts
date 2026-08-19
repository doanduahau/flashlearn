import { expect, test } from "@playwright/test";

import { signUpAndConfirm, uniqueEmail } from "./support/auth-helpers";

test.skip(
  process.env.CAPYSTUDY_CATALOG_ENABLED !== "true",
  "Catalog E2E requires the catalog feature flag.",
);

test("browses, previews and installs a catalog set for Study and Quiz", async ({ page }) => {
  await signUpAndConfirm(page, uniqueEmail("catalog_install"));

  await page.goto("/sets");
  await page.getByRole("link", { name: /Thư viện Flashcard/ }).click();
  await expect(page).toHaveURL(/\/sets\/catalog$/);
  await expect(page.getByRole("heading", { name: "Bộ khởi đầu" })).toBeVisible();

  await page.getByRole("link", { name: /Từ vựng tiếng Anh: Trái cây/ }).click();
  await expect(page.getByRole("heading", { name: "Từ vựng tiếng Anh: Trái cây" })).toBeVisible();
  await expect(page.getByText("Táo")).toBeVisible();
  await page.getByRole("button", { name: "Thêm vào bộ của bạn" }).dblclick();
  await expect(page).toHaveURL(/\/sets\/[0-9a-f-]+$/);
  await expect(page.getByText(/50 flashcard/)).toBeVisible();

  await page.goto("/sets/library");
  await expect(page.getByText("Từ vựng tiếng Anh: Trái cây", { exact: true })).toBeVisible();
  await page.goto("/study");
  await expect(page.getByText("Từ vựng tiếng Anh: Trái cây", { exact: true })).toBeVisible();
  await page.goto("/quiz");
  await expect(page.getByText("Từ vựng tiếng Anh: Trái cây", { exact: true })).toBeVisible();
});
