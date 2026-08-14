import { expect, test } from "@playwright/test";

import { signUpAndConfirm, uniqueEmail } from "./support/auth-helpers";

test.describe("Primary application navigation", () => {
  test("keeps five primary mobile destinations and exposes consolidated tabs", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await signUpAndConfirm(page, uniqueEmail("primary_navigation"));

    await page.goto("/dashboard");
    await expect(page.getByLabel(/CSV\/XLSX/i)).toHaveCount(0);
    await page.goto("/sets");
    await page.getByRole("link", { name: "Nhập Excel" }).click();
    await expect(page).toHaveURL(/\/sets\?create=import$/);
    await expect(page.getByLabel(/CSV\/XLSX/i)).toBeVisible();
    await page.getByRole("link", { name: "Đóng" }).click();
    await expect(page).toHaveURL(/\/sets$/);
    await page.getByRole("link", { name: "Thủ công" }).click();
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

  test("dashboard mobile bottom navigation matches other app pages", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signUpAndConfirm(page, uniqueEmail("primary_nav_dashboard"));

    const navigation = page.getByRole("navigation", { name: "Điều hướng chính" }).last();
    const navLinks = ["Tổng quan", "Bộ flashcard", "Học", "Kiểm tra", "Cá nhân"];

    await page.goto("/dashboard");
    await expect(navigation.getByRole("link")).toHaveCount(5);
    const dashboardBox = await navigation.boundingBox();
    expect(dashboardBox).not.toBeNull();
    expect(Math.round(dashboardBox?.width ?? 0)).toBe(390);
    for (const label of navLinks) {
      await expect(navigation.getByRole("link", { name: label })).toBeVisible();
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);

    // A non-Dashboard route must render the same navigation dimensions.
    await page.goto("/sets");
    await expect(navigation.getByRole("link")).toHaveCount(5);
    const setsBox = await navigation.boundingBox();
    expect(setsBox).not.toBeNull();
    expect(Math.round(setsBox?.width ?? 0)).toBe(390);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
  });

  test("header content is customized per viewport and mascot/sign-out is absent from mobile header", async ({
    page,
  }) => {
    await signUpAndConfirm(page, uniqueEmail("header_content"));

    // Mobile Viewport
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard");

    const mobileHeader = page.locator("header");
    await expect(mobileHeader.locator('img[src="/mascot/logo.png"]')).toBeVisible();
    await expect(mobileHeader).toContainText("CapyStudy");
    await expect(mobileHeader.locator('a[href="/profile?tab=statistics"]')).toBeVisible();

    // Avatar, Name, and Sign out absent on mobile header
    await expect(mobileHeader.getByRole("button", { name: "Đăng xuất" })).toHaveCount(0);

    // Desktop Viewport
    await page.setViewportSize({ width: 1280, height: 800 });
    const sidebar = page.locator("aside");
    await expect(sidebar.locator('img[src="/mascot/logo.png"]')).toBeVisible();
    await expect(sidebar).toContainText("CapyStudy");
  });
});
