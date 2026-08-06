import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { expect, type Page, test } from "@playwright/test";

import { signUpAndConfirm, uniqueEmail } from "./support/auth-helpers";

const IMPORT_CSV = "tests/fixtures/set-management.csv";
const SET_NAME = "Bộ gom thẻ A";
const AUTH_STATE = "tests/e2e/.auth/collection-a.json";

test.describe("Special collections", () => {
  test.describe.configure({ mode: "serial" });

  let setId = "";
  let khóNhớId = "";
  let yêuThíchId = "";

  test("User A imports a set, creates collections, and adds a card to both", async ({ page }) => {
    await signUpAndConfirm(page, uniqueEmail("coll_a"));

    await page.goto("/import");
    await page.getByLabel(/CSV\/XLSX/i).setInputFiles(IMPORT_CSV);
    await page.getByLabel(/^4\./).fill(SET_NAME);
    await page.getByRole("button", { name: /Xác nhận import/i }).click();

    await expect(page).toHaveURL(/\/sets\/[0-9a-f-]+$/);
    setId = new URL(page.url()).pathname.split("/").pop() ?? "";
    expect(setId).toMatch(/^[0-9a-f-]+$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(SET_NAME);

    await createCollection(page, "Khó nhớ");
    await createCollection(page, "Yêu thích");

    await page.goto("/collections");
    const khóNhớLink = page.getByRole("link", { name: /Khó nhớ/ });
    const yêuThíchLink = page.getByRole("link", { name: /Yêu thích/ });
    await expect(khóNhớLink).toBeVisible();
    await expect(yêuThíchLink).toBeVisible();
    await expect(khóNhớLink.getByText(/0 thẻ/)).toBeVisible();
    khóNhớId = collectionIdFromHref(await khóNhớLink.getAttribute("href"));
    yêuThíchId = collectionIdFromHref(await yêuThíchLink.getAttribute("href"));

    await duplicateNameRejected(page, "khó nhớ");

    await page.goto(`/sets/${setId}`);
    await addCardToCollections(page, "Xin chào", ["Khó nhớ", "Yêu thích"]);

    mkdirSync(dirname(AUTH_STATE), { recursive: true });
    await page.context().storageState({ path: AUTH_STATE });
  });

  test("User A sees memberships in each collection and removes a card from one", async ({
    browser,
  }) => {
    const context = await browser.newContext({ storageState: AUTH_STATE });
    const page = await context.newPage();

    await page.goto("/collections");
    await expect(page.getByRole("link", { name: /Khó nhớ/ }).getByText(/1 thẻ/)).toBeVisible();
    await expect(page.getByRole("link", { name: /Yêu thích/ }).getByText(/1 thẻ/)).toBeVisible();

    await page.getByRole("link", { name: /Khó nhớ/ }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Khó nhớ");
    await expect(page.getByText(/1 thẻ/)).toBeVisible();
    await expect(page.getByText("Xin chào")).toBeVisible();
    await expect(page.getByText(SET_NAME)).toBeVisible();
    await expect(page.locator("li").filter({ hasText: "Xin chào" })).toHaveCount(1);

    await removeCardFromCollection(page);

    await expect(page.getByText("Xin chào")).toHaveCount(0);
    await expect(page.getByText(/0 thẻ/)).toBeVisible();

    await context.close();
  });

  test("User A renames a collection and deletes the other", async ({ browser }) => {
    const context = await browser.newContext({ storageState: AUTH_STATE });
    const page = await context.newPage();

    await page.goto(`/collections/${yêuThíchId}`);
    await page.getByRole("button", { name: /Đổi tên/ }).click();
    await page.getByLabel("Tên bộ").fill("Quan trọng");
    await page.getByRole("button", { name: /^Lưu$/i }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Quan trọng");

    await page.goto(`/collections/${khóNhớId}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Khó nhớ");
    await page.getByRole("button", { name: /Xóa bộ/ }).click();
    await page.getByRole("button", { name: /Xóa vĩnh viễn/ }).click();
    await expect(page).toHaveURL(/\/collections$/);
    await expect(page.getByRole("link", { name: /Khó nhớ/ })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Quan trọng/ })).toBeVisible();

    const response = await page.goto(`/collections/${khóNhớId}`);
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("404");

    await context.close();
  });

  test("User B cannot view or mutate User A's collections", async ({ page }) => {
    await signUpAndConfirm(page, uniqueEmail("coll_b"));

    await page.goto("/collections");
    await expect(page.getByRole("link", { name: /Quan trọng/ })).toHaveCount(0);
    await expect(page.getByText(/Chưa có bộ đặc biệt/)).toBeVisible();

    const response = await page.goto(`/collections/${yêuThíchId}`);
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("404");
  });
});

function collectionIdFromHref(href: string | null): string {
  return new URL(href ?? "", "http://127.0.0.1:3000").pathname.split("/").pop() ?? "";
}

async function createCollection(page: Page, name: string): Promise<void> {
  await page.goto("/collections");
  await page.getByLabel("Tên bộ").fill(name);
  await page.getByRole("button", { name: /Tạo bộ/ }).click();
  await expect(page.getByRole("link", { name: new RegExp(name, "i") })).toBeVisible();
}

async function duplicateNameRejected(page: Page, name: string): Promise<void> {
  await page.getByLabel("Tên bộ").fill(name);
  await page.getByRole("button", { name: /Tạo bộ/ }).click();
  await expect(page.getByText("Tên đã tồn tại.")).toBeVisible();
}

async function addCardToCollections(
  page: Page,
  cardFront: string,
  collectionNames: string[],
): Promise<void> {
  const row = page.locator("li").filter({ hasText: cardFront }).last();
  const trigger = row.getByRole("button", { name: "Bộ đặc biệt (0)" });
  await trigger.click();
  for (const name of collectionNames) {
    await row.getByRole("checkbox", { name: new RegExp(name, "i") }).check();
  }
  await row.getByRole("button", { name: /^Lưu$/i }).click();
  await expect(
    row.getByRole("button", { name: `Bộ đặc biệt (${collectionNames.length})` }),
  ).toBeVisible();

  await row.getByRole("button", { name: `Bộ đặc biệt (${collectionNames.length})` }).click();
  await row.getByRole("button", { name: /^Lưu$/i }).click();
  await expect(
    row.getByRole("button", { name: `Bộ đặc biệt (${collectionNames.length})` }),
  ).toBeVisible();
}

async function removeCardFromCollection(page: Page): Promise<void> {
  await page.getByRole("button", { name: /Bỏ thẻ/ }).click();
  await page.getByRole("button", { name: /Bỏ thẻ/ }).click();
  await expect(page.getByText("Xin chào")).toHaveCount(0);
}
