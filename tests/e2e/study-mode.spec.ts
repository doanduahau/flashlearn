import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { expect, type Page, test } from "@playwright/test";

import { signUpAndConfirm, uniqueEmail } from "./support/auth-helpers";

const IMPORT_CSV = "tests/fixtures/set-management.csv";
const SET_A_NAME = "Bộ học A";
const SET_B_NAME = "Bộ học B";
const COLLECTION_NAME = "Khó nhớ";
const AUTH_STATE = "tests/e2e/.auth/study-a.json";

test.describe("Study mode", () => {
  test.describe.configure({ mode: "serial" });

  let setAId = "";
  let collectionId = "";

  test("User A imports two sets and adds an overlapping card to a collection", async ({ page }) => {
    await signUpAndConfirm(page, uniqueEmail("study_a"));

    setAId = await importSet(page, SET_A_NAME);
    await importSet(page, SET_B_NAME);
    collectionId = await createCollection(page, COLLECTION_NAME);

    await page.goto(`/sets/${setAId}`);
    await addCardToCollection(page, "Xin chào", COLLECTION_NAME);

    mkdirSync(dirname(AUTH_STATE), { recursive: true });
    await page.context().storageState({ path: AUTH_STATE });
  });

  test("selection shows an immediate count from source card counts", async ({ browser }) => {
    const context = await browser.newContext({ storageState: AUTH_STATE });
    const page = await context.newPage();

    await page.goto("/study");
    await expect(page.getByRole("radio", { name: /Tất cả 4 thẻ/ })).toBeChecked();

    await page.getByRole("checkbox", { name: new RegExp(SET_A_NAME) }).check();
    await page.getByRole("checkbox", { name: new RegExp(COLLECTION_NAME) }).check();
    await expect(page.getByText("2 nguồn · 3 thẻ")).toBeVisible();

    await page.getByRole("checkbox", { name: new RegExp(SET_A_NAME) }).uncheck();
    await page.getByRole("checkbox", { name: new RegExp(COLLECTION_NAME) }).uncheck();
    await expect(page.getByText("0 nguồn · 0 thẻ")).toBeVisible();
    await expect(page.getByRole("button", { name: /Bắt đầu học/ })).toBeDisabled();

    await context.close();
  });

  test("Quiz source selection stays within one source area on mobile", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: AUTH_STATE,
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();

    await page.goto("/quiz");
    const header = page.locator("header");
    await expect(header.locator('img[src*="logo.png"]')).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
    const allCards = page.locator('input[type="radio"]').first();
    await expect(allCards).toBeChecked();

    const regularA = page.getByRole("checkbox", { name: new RegExp(SET_A_NAME) });
    const regularB = page.getByRole("checkbox", { name: new RegExp(SET_B_NAME) });
    await regularA.check();
    await regularB.check();
    await expect(regularA).toBeChecked();
    await expect(regularB).toBeChecked();
    expect((await regularA.locator("xpath=..").boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(
      40,
    );

    await page.getByRole("button", { name: "Bộ đặc biệt" }).click();
    const special = page.getByRole("checkbox", { name: new RegExp(COLLECTION_NAME) });
    await special.check();
    await expect(special).toBeChecked();

    await allCards.check();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);

    await context.close();
  });

  test("starts a session that flips, navigates and finishes", async ({ browser }) => {
    const context = await browser.newContext({ storageState: AUTH_STATE });
    const page = await context.newPage();

    await page.goto("/study");
    await page.getByRole("checkbox", { name: new RegExp(SET_A_NAME) }).check();
    await page.getByRole("checkbox", { name: new RegExp(COLLECTION_NAME) }).check();
    await expect(page.getByText("2 nguồn · 3 thẻ")).toBeVisible();
    await page.getByRole("button", { name: /Bắt đầu học/ }).click();
    await expect(page).toHaveURL(/\/study\/mode\?sets=/);
    await page.getByRole("button", { name: /Bắt đầu lật thẻ/ }).click();

    await expect(page).toHaveURL(/\/study\/session\?sets=/);
    await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuemax", "2");
    await expect(page.getByText("1 / 2")).toBeVisible();
    await expect(page.getByText("Bộ học A")).toBeVisible();
    await expect(page.getByText("Xin chào")).toBeVisible();
    const collectionTrigger = page.getByRole("button", { name: "Thêm vào bộ đặc biệt" });
    await expect(collectionTrigger).toHaveAttribute("title", "Thêm vào bộ đặc biệt");
    await collectionTrigger.click();
    await expect(page.getByRole("checkbox", { name: new RegExp(COLLECTION_NAME) })).toBeChecked();
    await page.getByRole("button", { name: /^Hủy$/i }).click();

    await page.locator('[data-testid="study-card"][data-active="true"]').click();
    await expect(page.getByText("Hello")).toBeVisible();

    await page.keyboard.press("ArrowDown");
    await expect(page.getByText("2 / 2")).toBeVisible();
    await expect(page.getByText("Cảm ơn")).toBeVisible();

    await page.keyboard.press("ArrowUp");
    await expect(page.getByText("1 / 2")).toBeVisible();

    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("button", { name: /Hoàn thành/ })).toBeVisible();
    await page.getByRole("button", { name: /Hoàn thành/ }).click();
    await expect(page.getByRole("heading", { name: "Hoàn thành!" })).toBeVisible();
    await expect(page.getByText("Đã xem 2 thẻ")).toBeVisible();
    await expect(page.locator('img[src*="congrats.png"]')).toBeVisible();

    await page.getByRole("button", { name: /Chơi lại/ }).click();
    await expect(page.getByText("1 / 2")).toBeVisible();

    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("button", { name: /Hoàn thành/ })).toBeVisible();
    await page.getByRole("button", { name: /Hoàn thành/ }).click();
    await expect(page.getByRole("heading", { name: "Hoàn thành!" })).toBeVisible();
    await page.getByRole("button", { name: /Thoát/ }).click();
    await expect(page).toHaveURL(/\/study\/mode\?sets=/);

    await context.close();
  });

  test("flip session back arrow returns to the mode selection with the same source", async ({
    browser,
  }) => {
    const context = await browser.newContext({ storageState: AUTH_STATE });
    const page = await context.newPage();

    await page.goto("/study");
    await page.getByRole("checkbox", { name: new RegExp(SET_A_NAME) }).check();
    await page.getByRole("checkbox", { name: new RegExp(COLLECTION_NAME) }).check();
    await page.getByRole("button", { name: /Bắt đầu học/ }).click();
    await expect(page).toHaveURL(/\/study\/mode\?sets=/);
    await page.getByRole("button", { name: /Bắt đầu lật thẻ/ }).click();
    await expect(page).toHaveURL(/\/study\/session\?sets=/);

    // Hủy keeps the learner in the session.
    await page.getByRole("button", { name: /Thoát phiên học/ }).click();
    await expect(page.getByRole("dialog", { name: "Thoát phiên?" })).toBeVisible();
    await page.getByRole("button", { name: "Hủy" }).click();
    await expect(page).toHaveURL(/\/study\/session\?sets=/);

    // Confirmed exit returns to the mode selection with the same source.
    await page.getByRole("button", { name: /Thoát phiên học/ }).click();
    await page.getByRole("button", { name: "Thoát", exact: true }).click();
    await expect(page).toHaveURL(/\/study\/mode\?sets=/);
    await expect(page.getByRole("heading", { name: "Lật thẻ" })).toBeVisible();

    await context.close();
  });

  test("keyboard navigation on the Flashcard Wheel advances and goes back", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: AUTH_STATE,
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();

    await page.goto("/study");
    await page.getByRole("checkbox", { name: new RegExp(SET_A_NAME) }).check();
    await page.getByRole("checkbox", { name: new RegExp(COLLECTION_NAME) }).check();
    await expect(page.getByText("2 nguồn · 3 thẻ")).toBeVisible();
    await page.getByRole("button", { name: /Bắt đầu học/ }).click();
    await expect(page).toHaveURL(/\/study\/mode/);
    await page.getByRole("button", { name: /Bắt đầu lật thẻ/ }).click();
    await expect(page).toHaveURL(/\/study\/session/);
    await expect(page.getByText("1 / 2")).toBeVisible();

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);

    await page.keyboard.press("ArrowDown");
    await expect(page.getByText("2 / 2")).toBeVisible();

    await page.keyboard.press("ArrowUp");
    await expect(page.getByText("1 / 2")).toBeVisible();

    await page.locator('[data-testid="study-card"][data-active="true"]').click();
    await expect(page.getByText("Hello")).toBeVisible();

    await context.close();
  });

  test("all-cards session keeps its order across refresh", async ({ browser }) => {
    const context = await browser.newContext({ storageState: AUTH_STATE });
    const page = await context.newPage();

    await page.goto("/study");
    await page.getByRole("button", { name: /Bắt đầu học/ }).click();
    await expect(page).toHaveURL(/\/study\/mode\?all=1$/);
    await page.getByRole("button", { name: /Bắt đầu lật thẻ/ }).click();
    await expect(page).toHaveURL(/\/study\/session\?all=1$/);
    await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuemax", "4");
    await expect(page.getByText("1 / 4")).toBeVisible();

    const frontBefore = await page.locator('[aria-hidden="false"]').first().textContent();

    await page.reload();
    await expect(page.getByText("1 / 4")).toBeVisible();
    const frontAfter = await page.locator('[aria-hidden="false"]').first().textContent();
    expect(frontAfter).toBe(frontBefore);

    await context.close();
  });

  test("keyboard navigation works and seeded shuffle persists across refresh", async ({
    browser,
  }) => {
    const context = await browser.newContext({ storageState: AUTH_STATE });
    const page = await context.newPage();

    await page.goto("/study");
    await page.getByRole("button", { name: /Bắt đầu học/ }).click();
    await expect(page).toHaveURL(/\/study\/mode/);
    await page.getByRole("button", { name: /Bắt đầu lật thẻ/ }).click();
    await expect(page).toHaveURL(/\/study\/session/);
    await expect(page.getByText("1 / 4")).toBeVisible();

    await page.keyboard.press("ArrowRight");
    await expect(page.getByText("2 / 4")).toBeVisible();
    await page.keyboard.press("ArrowLeft");
    await expect(page.getByText("1 / 4")).toBeVisible();
    await page.keyboard.press(" ");
    await expect(
      page.locator('[data-testid="study-card"][data-active="true"]').getByText("Hello"),
    ).toBeVisible();

    await page.getByRole("button", { name: /Trộn thứ tự/ }).click();
    await expect(page).toHaveURL(/seed=\d+/);
    const seed = new URL(page.url()).searchParams.get("seed");
    expect(seed).not.toBeNull();

    const frontBefore = await page.locator('[aria-hidden="false"]').first().textContent();

    await page.reload();
    await expect(page.getByText("1 / 4")).toBeVisible();
    expect(new URL(page.url()).searchParams.get("seed")).toBe(seed);
    const frontAfter = await page.locator('[aria-hidden="false"]').first().textContent();
    expect(frontAfter).toBe(frontBefore);

    await context.close();
  });

  test("adds and removes the current card from a collection inside the session", async ({
    browser,
  }) => {
    const context = await browser.newContext({ storageState: AUTH_STATE });
    const page = await context.newPage();

    await page.goto("/study");
    await page.getByRole("checkbox", { name: new RegExp(SET_A_NAME) }).check();
    await page.getByRole("checkbox", { name: new RegExp(COLLECTION_NAME) }).check();
    await expect(page.getByText("2 nguồn · 3 thẻ")).toBeVisible();
    await page.getByRole("button", { name: /Bắt đầu học/ }).click();
    await expect(page).toHaveURL(/\/study\/mode/);
    await page.getByRole("button", { name: /Bắt đầu lật thẻ/ }).click();
    await expect(page).toHaveURL(/\/study\/session/);

    const collectionTrigger = page.getByRole("button", { name: "Thêm vào bộ đặc biệt" });

    await collectionTrigger.click();
    await page.getByRole("checkbox", { name: new RegExp(COLLECTION_NAME) }).uncheck();
    await page.getByRole("button", { name: /^Lưu$/i }).click();
    await collectionTrigger.click();
    await expect(
      page.getByRole("checkbox", { name: new RegExp(COLLECTION_NAME) }),
    ).not.toBeChecked();
    await page.getByRole("button", { name: /^Hủy$/i }).click();

    await collectionTrigger.click();
    await page.getByRole("checkbox", { name: new RegExp(COLLECTION_NAME) }).check();
    await page.getByRole("button", { name: /^Lưu$/i }).click();
    await collectionTrigger.click();
    await expect(page.getByRole("checkbox", { name: new RegExp(COLLECTION_NAME) })).toBeChecked();

    await context.close();
  });

  test("User B cannot forge another user's session and sees the empty study state", async ({
    page,
  }) => {
    await signUpAndConfirm(page, uniqueEmail("study_b"));

    await page.goto(`/study/session?sets=${setAId}`);
    await expect(page).toHaveURL(/\/study$/);
    await page.goto(`/study/session?collections=${collectionId}`);
    await expect(page).toHaveURL(/\/study$/);
    await expect(page.getByText("Chưa có thẻ flashcard để học.")).toBeVisible();
  });
});

function collectionIdFromHref(href: string | null): string {
  return new URL(href ?? "", "http://127.0.0.1:3000").pathname.split("/").pop() ?? "";
}

async function importSet(page: Page, name: string): Promise<string> {
  await page.goto("/sets/create?source=file");
  await page.getByLabel(/CSV\/XLSX/i).setInputFiles(IMPORT_CSV);
  await page.getByRole("button", { name: "Phân tích" }).click();
  await page.getByLabel("Tên bộ").fill(name);
  await page.getByRole("button", { name: /Tạo bộ flashcard/i }).click();
  await expect(page).toHaveURL(/\/sets\/[0-9a-f-]+$/);
  return new URL(page.url()).pathname.split("/").pop() ?? "";
}

async function createCollection(page: Page, name: string): Promise<string> {
  await page.goto("/collections");
  await page.getByRole("button", { name: /Tạo bộ đặc biệt/ }).click();
  await page.getByLabel("Tên bộ").fill(name);
  await page.getByRole("button", { name: /^Tạo bộ$/ }).click();
  const link = page.getByRole("link", { name: new RegExp(name, "i") });
  await expect(link).toBeVisible();
  return collectionIdFromHref(await link.getAttribute("href"));
}

async function addCardToCollection(page: Page, cardFront: string, collectionName: string) {
  const row = page.locator("li").filter({ hasText: cardFront }).last();
  const trigger = row.getByRole("button", { name: "Thêm vào bộ đặc biệt" });
  await trigger.click();
  await row.getByRole("checkbox", { name: new RegExp(collectionName, "i") }).check();
  await row.getByRole("button", { name: /^Lưu$/i }).click();
  await expect(trigger).toBeVisible();
  await trigger.click();
  await expect(row.getByRole("checkbox", { name: new RegExp(collectionName, "i") })).toBeChecked();
  await row.getByRole("button", { name: /Hủy/i }).click();
}
