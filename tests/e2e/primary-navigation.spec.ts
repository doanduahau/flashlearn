import { expect, test } from "@playwright/test";

import { signUpAndConfirm, uniqueEmail } from "./support/auth-helpers";

test.describe("Primary application navigation", () => {
  test("keeps five primary mobile destinations and exposes consolidated tabs", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await signUpAndConfirm(page, uniqueEmail("primary_navigation"));

    await page.goto("/dashboard");
    await expect(page.getByLabel(/CSV\/XLSX/i)).toHaveCount(0);
    await page.goto("/sets");
    await page.getByRole("link", { name: "Nhập từ tệp" }).click();
    await expect(page).toHaveURL(/\/sets\?create=import$/);
    await expect(page.getByLabel(/CSV\/XLSX/i)).toBeVisible();
    await page.getByRole("link", { name: "Đóng" }).click();
    await expect(page).toHaveURL(/\/sets$/);
    await page.getByRole("link", { name: "Tạo bộ thủ công" }).click();
    await expect(page).toHaveURL(/\/sets\?create=manual$/);
    await expect(page.getByLabel("Tên bộ flashcard")).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: "Đóng" }).click();
    await expect(page).toHaveURL(/\/sets$/);

    const navigation = page.getByRole("navigation", { name: "Điều hướng chính" }).last();
    await expect(navigation.getByRole("link")).toHaveCount(5);
    await expect(navigation.getByRole("button")).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);

    await navigation.getByRole("link", { name: "Bộ flashcard" }).click();
    await expect(page).toHaveURL(/\/sets$/);
    await page.getByRole("link", { name: "Bộ đặc biệt" }).click();
    await expect(page).toHaveURL(/\/sets\?tab=special$/);

    await navigation.getByRole("link", { name: "Kiểm tra" }).click();
    await page.getByRole("link", { name: "Lịch sử" }).click();
    await expect(page).toHaveURL(/\/quiz\?tab=history$/);

    await navigation.getByRole("link", { name: "Cá nhân" }).click();
    await expect(page).toHaveURL(/\/profile$/);
    await page.getByRole("link", { name: "Thống kê" }).click();
    await expect(page).toHaveURL(/\/profile\?tab=statistics/);
  });

  test("redirects legacy primary routes to their consolidated destinations", async ({ page }) => {
    await signUpAndConfirm(page, uniqueEmail("primary_legacy"));

    await page.goto("/import");
    await expect(page).toHaveURL(/\/sets\?create=import$/);
    await page.goto("/collections");
    await expect(page).toHaveURL(/\/sets\?tab=special$/);
    await page.goto("/history");
    await expect(page).toHaveURL(/\/quiz\?tab=history$/);
    await page.goto("/statistics");
    await expect(page).toHaveURL(/\/profile\?tab=statistics$/);
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/profile\?tab=settings$/);
  });
});
