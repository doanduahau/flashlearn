import { expect, test } from "@playwright/test";

import { signUpAndConfirm, uniqueEmail } from "./support/auth-helpers";

const IMPORT_CSV = "tests/fixtures/set-management.csv";

test.describe("Responsive flashcard management and navigation", () => {
  test("keeps long card content readable and actions in viewport at mobile width", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signUpAndConfirm(page, uniqueEmail("responsive"));

    await page.goto("/import");
    await page.getByLabel(/CSV\/XLSX/i).setInputFiles(IMPORT_CSV);
    await page.getByLabel(/^4\./).fill("Bộ giao diện mobile");
    await page.getByRole("button", { name: /Xác nhận import/i }).click();
    await expect(page).toHaveURL(/\/sets\/[0-9a-f-]+$/);

    const fields = page.locator("textarea");
    await fields
      .nth(0)
      .fill(
        "Nội dung tiếng Việt rất dài để kiểm tra xuống dòng tự nhiên 日本語の長い単語と文章が狭い画面でも一文字ずつにならないことを確認します",
      );
    await fields.nth(1).fill("Mặt sau dài nhưng vẫn phải dễ đọc");
    await page.getByRole("button", { name: /Thêm thẻ/i }).click();

    // Wait for the new card to be appended (there are 2 fixtures + 1 new = 3)
    await expect(page.locator("ol > li")).toHaveCount(3);

    const card = page.locator("ol > li").last();
    const before = await card.boundingBox();
    expect(before?.width).toBeGreaterThan(300);

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);

    await card.getByRole("button", { name: /Sửa thẻ/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    expect(await card.boundingBox()).toMatchObject({
      width: before?.width,
      height: before?.height,
    });
    await page.getByRole("dialog").getByRole("button", { name: /Hủy/i }).click();

    await card.getByRole("button", { name: /Xóa thẻ/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    expect(await card.boundingBox()).toMatchObject({
      width: before?.width,
      height: before?.height,
    });
    await page.keyboard.press("Escape");

    const mobileNav = page.getByRole("navigation", { name: /Điều hướng chính/i });
    await expect(mobileNav.getByRole("link")).toHaveCount(5);
    for (const item of await mobileNav.locator("a").all()) {
      const box = await item.boundingBox();
      expect(box?.width).toBeGreaterThan(0);
    }

    await mobileNav.getByRole("link", { name: "Cá nhân" }).click();
    await expect(page).toHaveURL(/\/profile$/);
  });

  test("shows the streak in the mobile header on every authenticated page", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signUpAndConfirm(page, uniqueEmail("streak"));

    await page.goto("/dashboard");
    const mobileHeader = page.locator("header");
    const streak = mobileHeader.getByLabel(/Chuỗi \d+ ngày/);
    await expect(streak).toBeVisible();
    await expect(streak).toHaveText("0");
    await expect(streak).toHaveAttribute("aria-label", /hôm nay chưa hoàn thành/);
  });
});
