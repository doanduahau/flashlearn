import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { expect, type Page, test } from "@playwright/test";

import { signUpAndConfirm, uniqueEmail } from "./support/auth-helpers";

const IMPORT_CSV = "tests/fixtures/set-management.csv";
const SET_NAME = "Bộ quản lý A";
const AUTH_STATE = "tests/e2e/.auth/user-a.json";

test.describe("Set and card management", () => {
  test.describe.configure({ mode: "serial" });

  let setId = "";
  let renamedSetName = "";

  test("User A imports a set and manages its cards", async ({ page }) => {
    await signUpAndConfirm(page, uniqueEmail("setmgr_a"));

    await page.goto("/import");
    await page.getByLabel(/CSV\/XLSX/i).setInputFiles(IMPORT_CSV);
    await page.getByLabel(/^4\./).fill(SET_NAME);
    await page.getByRole("button", { name: /Xác nhận import/i }).click();

    await expect(page).toHaveURL(/\/sets\/[0-9a-f-]+$/);
    setId = new URL(page.url()).pathname.split("/").pop() ?? "";
    expect(setId).toMatch(/^[0-9a-f-]+$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(SET_NAME);
    await expect(page.getByText(/2 flashcard/)).toBeVisible();
    await expect(page.getByText("Xin chào")).toBeVisible();

    await renameSet(page);
    renamedSetName = "Bộ quản lý đổi tên";
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(renamedSetName);

    await addCard(page, "Thẻ mới thủ công", "Card mới thủ công");
    await expect(page.getByText(/3 flashcard/)).toBeVisible();

    await addCardOnceWhilePending(page, "Thẻ duy nhất", "Back duy nhất");
    await expect(page.getByText(/4 flashcard/)).toBeVisible();

    await editCard(page, "Thẻ duy nhất", "Thẻ đã sửa", "Back đã sửa");

    await deleteCard(page, "Thẻ đã sửa");
    await expect(page.getByText(/3 flashcard/)).toBeVisible();

    mkdirSync(dirname(AUTH_STATE), { recursive: true });
    await page.context().storageState({ path: AUTH_STATE });
  });

  test("User B cannot view or manage User A's data", async ({ page }) => {
    await signUpAndConfirm(page, uniqueEmail("setmgr_b"));

    await page.goto("/sets");
    await expect(page.getByText(renamedSetName)).toHaveCount(0);

    const response = await page.goto(`/sets/${setId}`);
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("404");
  });

  test("User A deletes the set and direct access returns a non-disclosing not-found", async ({
    browser,
  }) => {
    const context = await browser.newContext({ storageState: AUTH_STATE });
    const page = await context.newPage();

    await page.goto(`/sets/${setId}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(renamedSetName);

    await deleteSet(page);
    await expect(page).toHaveURL(/\/sets$/);
    await expect(page.getByText(renamedSetName)).toHaveCount(0);

    const response = await page.goto(`/sets/${setId}`);
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("404");

    await context.close();
  });
});

async function renameSet(page: Page): Promise<void> {
  await page.getByRole("button", { name: /Đổi tên/i }).click();
  const nameInput = page.getByLabel("Tên bộ");
  await nameInput.fill("Bộ quản lý đổi tên");
  await page.getByRole("button", { name: /^Lưu$/i }).click();
}

async function addCard(page: Page, front: string, back: string): Promise<void> {
  await page.getByLabel("Mặt trước").fill(front);
  await page.getByLabel("Mặt sau").fill(back);
  await page.getByRole("button", { name: /Thêm thẻ/i }).click();
  await expect(page.getByText(front)).toHaveCount(1);
}

async function addCardOnceWhilePending(page: Page, front: string, back: string): Promise<void> {
  await page.getByLabel("Mặt trước").fill(front);
  await page.getByLabel("Mặt sau").fill(back);
  const addButton = page.getByRole("button", { name: /Thêm thẻ/i });
  await addButton.click();
  await expect(addButton).toBeDisabled();
  await addButton.click({ force: true }).catch(() => undefined);
  await expect(page.getByText(front)).toHaveCount(1);
}

async function editCard(
  page: Page,
  oldFront: string,
  newFront: string,
  newBack: string,
): Promise<void> {
  const row = page.locator("li").filter({ hasText: oldFront }).last();
  await row.getByRole("button", { name: /Sửa/i }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Mặt trước").fill(newFront);
  await dialog.getByLabel("Mặt sau").fill(newBack);
  await dialog.getByRole("button", { name: /^Lưu$/i }).click();
  await expect(page.getByText(newFront)).toHaveCount(1);
}

async function deleteCard(page: Page, front: string): Promise<void> {
  const row = page.locator("li").filter({ hasText: front }).last();
  await row.getByRole("button", { name: /Xóa thẻ/i }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Xóa vĩnh viễn/i })
    .click();
  await expect(page.getByText(front)).toHaveCount(0);
}

async function deleteSet(page: Page): Promise<void> {
  await page.getByRole("button", { name: /Xóa bộ/i }).click();
  await page.getByRole("button", { name: /Xóa vĩnh viễn/i }).click();
}
