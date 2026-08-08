import { expect, test } from "@playwright/test";

import { signUpAndConfirm, uniqueEmail } from "./support/auth-helpers";

test.describe("Manual flashcard set creation", () => {
  test("creates a one-card set in a full-screen sheet at mobile width", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signUpAndConfirm(page, uniqueEmail("manual_one"));

    await page.goto("/sets");
    await page.getByRole("link", { name: /thủ công/i }).click();

    const dialog = page.getByRole("dialog", { name: "Tạo bộ thủ công" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute("aria-modal", "true");
    await dialog.getByLabel("Tên bộ flashcard").fill("Bộ thủ công một thẻ");
    await dialog.getByLabel("Mặt trước").fill("Xin chào");
    await dialog.getByLabel("Mặt sau").fill("Hello");
    await dialog.getByRole("button", { name: /tạo bộ/i }).click();

    await expect(page).toHaveURL(/\/sets\/[0-9a-f-]+$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bộ thủ công một thẻ");
    await expect(page.getByText(/1 flashcard/)).toBeVisible();
    await expect(page.getByText("Xin chào")).toBeVisible();
  });

  test("creates a multi-card set with added rows at mobile width", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signUpAndConfirm(page, uniqueEmail("manual_multi"));

    await page.goto("/sets");
    await page.getByRole("link", { name: /thủ công/i }).click();

    const dialog = page.getByRole("dialog", { name: "Tạo bộ thủ công" });
    await dialog.getByLabel("Tên bộ flashcard").fill("Bộ thủ công nhiều thẻ");
    await dialog.getByLabel("Mặt trước").fill("Một");
    await dialog.getByLabel("Mặt sau").fill("One");
    await dialog.getByRole("button", { name: /thêm thẻ/i }).click();
    await dialog.getByLabel("Mặt trước").nth(1).fill("Hai");
    await dialog.getByLabel("Mặt sau").nth(1).fill("Two");
    await dialog.getByRole("button", { name: /tạo bộ/i }).click();

    await expect(page).toHaveURL(/\/sets\/[0-9a-f-]+$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bộ thủ công nhiều thẻ");
    await expect(page.getByText(/2 flashcard/)).toBeVisible();
  });

  test("shows inline validation and keeps the sheet open when fields are empty", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signUpAndConfirm(page, uniqueEmail("manual_validation"));

    await page.goto("/sets");
    await page.getByRole("link", { name: /thủ công/i }).click();

    const dialog = page.getByRole("dialog", { name: "Tạo bộ thủ công" });
    await dialog.getByRole("button", { name: /tạo bộ/i }).click();
    await expect(dialog.getByText("Nhập tên bộ flashcard.")).toBeVisible();
    await expect(dialog.getByText("Mặt trước không được để trống.")).toBeVisible();
    await expect(dialog.getByText("Mặt sau không được để trống.")).toBeVisible();
    await expect(page).toHaveURL(/\/sets\?create=manual$/);
  });
});
