import { expect, type Locator, type Page, test } from "@playwright/test";

import { signUpAndConfirm, uniqueEmail } from "./support/auth-helpers";

const orderedNames = ["Order one", "Order two", "Order three"];

test("regular set order persists on mobile and remains usable on desktop", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signUpAndConfirm(page, uniqueEmail("set_order"));

  for (const name of orderedNames) {
    await createManualSet(page, name);
  }

  await page.goto("/sets?tab=regular");
  await page.getByRole("link", { name: /Sắp xếp/i }).click();
  await expect(page).toHaveURL(/reorder=1/);

  const list = page.getByRole("list", { name: "Thứ tự bộ flashcard" });
  await expect.poll(() => reorderSetNames(list)).toEqual(["Order three", "Order two", "Order one"]);
  await page.getByRole("button", { name: "Đưa Order two lên" }).click();
  await expect.poll(() => reorderSetNames(list)).toEqual(["Order two", "Order three", "Order one"]);
  await expect(page.getByText("Thứ tự đã được lưu.")).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByRole("link", { name: "Xong" }).click();
  await expect(page).not.toHaveURL(/reorder=1/);
  await expect.poll(() => regularSetNames(page)).toEqual(["Order two", "Order three", "Order one"]);

  await page.reload();
  await expect.poll(() => regularSetNames(page)).toEqual(["Order two", "Order three", "Order one"]);

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("link", { name: /Sắp xếp/i }).click();
  await expect.poll(() => reorderSetNames(list)).toEqual(["Order two", "Order three", "Order one"]);
  await expectNoHorizontalOverflow(page);
});

async function createManualSet(page: Page, name: string): Promise<void> {
  await page.goto("/dashboard?create=manual");
  const dialog = page.getByRole("dialog", { name: "Tạo bộ thủ công" });
  await dialog.getByLabel("Tên bộ flashcard").fill(name);
  await dialog.getByLabel("Mặt trước").fill(`${name} front`);
  await dialog.getByLabel("Mặt sau").fill(`${name} back`);
  await dialog.getByRole("button", { name: /^Tạo bộ$/i }).click();
  await expect(page).toHaveURL(/\/sets\/[0-9a-f-]+$/);
}

async function regularSetNames(page: Page): Promise<string[]> {
  return page.locator('a[href^="/sets/"] .font-semibold').allTextContents();
}

async function reorderSetNames(list: Locator): Promise<string[]> {
  return list.locator(".font-semibold").allTextContents();
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
}
