import { expect, type Page, test } from "@playwright/test";

import { signUpAndConfirm, uniqueEmail } from "./support/auth-helpers";

const MOBILE = { width: 390, height: 844 };

async function createSetWithCard(page: Page, name: string, front: string, back: string) {
  await page.goto("/sets/create?source=manual");
  await page.getByLabel("Tên bộ").fill(name);
  await page.getByLabel("Mặt trước").fill(front);
  await page.getByLabel("Mặt sau").fill(back);
  await page.getByRole("button", { name: "Tạo bộ" }).click();
  await expect(page).toHaveURL(/\/sets\/[0-9a-f-]+$/);
  return new URL(page.url()).pathname.split("/").pop() ?? "";
}

async function createCollection(page: Page, name: string) {
  await page.goto("/collections");
  await page.getByRole("button", { name: /Tạo bộ đặc biệt/ }).click();
  await page.getByLabel("Tên bộ").fill(name);
  await page.getByRole("button", { name: /^Tạo bộ$/ }).click();
  const link = page.getByRole("link", { name: new RegExp(name, "i") });
  await expect(link).toBeVisible();
}

test.describe("Visual mastery", () => {
  test("set detail shows neutral mastery on untested cards with accessible labels and no score", async ({
    page,
  }) => {
    await page.setViewportSize(MOBILE);
    await signUpAndConfirm(page, uniqueEmail("mastery_set"));

    await createSetWithCard(page, "Bộ mastery", "Mặt trước", "Mặt sau");

    const indicator = page.getByRole("img", { name: "Chưa học" });
    await expect(indicator).toBeVisible();

    const row = page.locator("li").filter({ hasText: "Mặt trước" }).first();
    await expect(row).toContainText("Mặt sau");
    await expect(row).not.toContainText(/%/);
    await expect(row).not.toContainText(/điểm|score|phần trăm/i);
    await expect(row).not.toContainText("Chưa học");

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);

    await page.getByRole("button", { name: "Trạng thái học" }).click();
    const legend = page.getByRole("region", { name: "Chú thích trạng thái học" });
    await expect(legend).toBeVisible();
    await expect(legend.getByText("Chưa học", { exact: true })).toBeVisible();
    await expect(legend.getByText("Cần ôn", { exact: true })).toBeVisible();
    await expect(legend.getByText("Đang học", { exact: true })).toBeVisible();
    await expect(legend.getByText("Đã nhớ", { exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(legend).not.toBeVisible();
  });

  test("special collection card list uses the same mastery visual", async ({ page }) => {
    await signUpAndConfirm(page, uniqueEmail("mastery_coll"));

    const setId = await createSetWithCard(page, "Bộ nguồn", "Trước", "Sau");
    await createCollection(page, "Bộ đặc biệt A");

    await page.goto(`/sets/${setId}`);
    const row = page.locator("li").filter({ hasText: "Trước" }).first();
    await row.getByRole("button", { name: "Thêm vào bộ đặc biệt" }).click();
    await row.getByRole("checkbox", { name: "Bộ đặc biệt A" }).check();
    await row.getByRole("button", { name: /^Lưu$/i }).click();
    await expect(row.getByRole("button", { name: "Thêm vào bộ đặc biệt" })).toBeVisible();

    await page.goto("/collections");
    await page.getByRole("link", { name: /Bộ đặc biệt A/ }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Bộ đặc biệt A");

    const collectionRow = page.locator("li").filter({ hasText: "Trước" }).first();
    await expect(collectionRow).toContainText("Sau");
    await expect(collectionRow.getByRole("img", { name: "Chưa học" })).toBeVisible();
    await expect(collectionRow).not.toContainText(/%/);
    await expect(collectionRow).not.toContainText(/điểm|score|phần trăm/i);
  });

  test("study session card stays free of mastery styling", async ({ page }) => {
    await signUpAndConfirm(page, uniqueEmail("mastery_study"));

    await createSetWithCard(page, "Bộ ôn", "Q", "A");

    await page.goto("/study");
    await page.getByRole("button", { name: /Bắt đầu học/ }).click();
    await expect(page).toHaveURL(/\/study\/session/);

    const card = page.getByTestId("study-card");
    await expect(card.getByRole("img", { name: /Chưa học|Cần ôn|Đang học|Đã nhớ/ })).toHaveCount(0);
    await expect(card).toContainText("Q");
  });
});
