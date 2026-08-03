import { expect, test } from "@playwright/test";

test("landing page shows FlashLearn branding", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("FlashLearn");
  await expect(page.getByRole("link", { name: "Đăng nhập" })).toBeVisible();
});
