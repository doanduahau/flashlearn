import { expect, type Page, test } from "@playwright/test";
import * as XLSX from "xlsx";

const APP_ORIGIN = "http://127.0.0.1:3000";
const TEST_PASSWORD = "TestPassword123!";

function uniqueEmail(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@test.capystudy.dev`;
}

async function signUp(page: Page, email: string, displayName: string): Promise<void> {
  await page.goto("/sign-up");
  await page.getByLabel("Tên hiển thị").fill(displayName);
  await page.getByLabel("Email").fill(email);
  await page.locator("#password").fill(TEST_PASSWORD);
  await page.locator("#confirmPassword").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: /đăng ký/i }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function signIn(page: Page, email: string): Promise<void> {
  await page.getByLabel("Email").fill(email);
  await page.locator("#password").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: /đăng nhập/i }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function signOut(page: Page): Promise<void> {
  await page.getByRole("button", { name: /đăng xuất/i }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
}

function xlsxFixture(): Buffer {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ["Ignore", "Ignore back"],
      ["unused", "unused"],
    ]),
    "First",
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ["Unused", "Front", "Back"],
      ["x", "Xin chào", "Hello"],
      ["safe", "<script>alert('unsafe')</script>", "Rendered safely"],
      ["y", "Cảm ơn", "Thanks"],
    ]),
    "Vietnamese",
  );
  return Buffer.from(XLSX.write(workbook, { type: "base64", bookType: "xlsx" }), "base64");
}

test("confirmation-disabled auth supports isolated CSV and XLSX imports", async ({
  page,
  context,
}) => {
  test.setTimeout(60_000);
  const userAEmail = uniqueEmail("import_a");
  const userBEmail = uniqueEmail("import_b");
  const storageRequests: string[] = [];
  const serverPayloads: string[] = [];

  context.on("request", (request) => {
    if (request.url().includes("/storage/v1")) storageRequests.push(request.url());
    if (request.method() === "POST" && request.url().startsWith(APP_ORIGIN)) {
      serverPayloads.push(request.postData() ?? "");
    }
  });

  await signUp(page, userAEmail, "Import User A");
  expect((await context.cookies(APP_ORIGIN)).some(({ name }) => name.includes("auth-token"))).toBe(
    true,
  );
  await page.reload();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto("/import");
  await page.locator("#import-file").setInputFiles({
    name: "cards.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "Front,Back\nOne,One back\nOne,One back\nPartial,\nThree,Three back\nTwo,Two back",
    ),
  });
  await expect(page.getByText(/Hợp lệ: 3/)).toBeVisible();
  await expect(page.getByText(/Thiếu một mặt: 1/)).toBeVisible();
  await expect(page.getByText(/Trùng: 1/)).toBeVisible();

  await page.getByLabel(/^3\./).selectOption("0");
  await expect(page.getByText(/hai cột khác nhau/)).toBeVisible();
  await page.getByLabel(/^3\./).selectOption("1");
  await page.getByLabel(/^4\./).fill("CSV Import");

  const csvSubmit = page.getByRole("button", { name: /xác nhận import/i });
  await csvSubmit.dblclick();
  await expect(page).toHaveURL(/\/sets\/[\w-]+$/);
  const userASetUrl = new URL(page.url()).pathname;
  await expect(page.getByText("3 flashcard")).toBeVisible();
  const csvCards = page.locator("ol > li");
  await expect(csvCards).toHaveCount(3);
  await expect(csvCards.nth(0)).toContainText("One");
  await expect(csvCards.nth(1)).toContainText("Three");
  await expect(csvCards.nth(2)).toContainText("Two");

  await page.goto("/sets");
  await expect(page.getByRole("link", { name: "CSV Import" })).toHaveCount(1);

  const xlsxPage = await context.newPage();
  await xlsxPage.goto("/import");
  await xlsxPage.locator("#import-file").setInputFiles({
    name: "multi-sheet.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: xlsxFixture(),
  });
  await xlsxPage.getByLabel(/^1\./).selectOption({ label: "Vietnamese" });
  await xlsxPage.getByLabel(/^2\./).selectOption("1");
  await xlsxPage.getByLabel(/^3\./).selectOption("2");
  await expect(xlsxPage.getByText(/Hợp lệ: 3/)).toBeVisible();
  await xlsxPage.getByLabel(/^4\./).fill("XLSX Import");
  await xlsxPage.getByRole("button", { name: /xác nhận import/i }).click();
  await expect(xlsxPage).toHaveURL(/\/sets\/[\w-]+$/);
  const xlsxCards = xlsxPage.locator("ol > li");
  await expect(xlsxCards).toHaveCount(3);
  await expect(xlsxCards.nth(0)).toContainText("Xin chào");
  await expect(xlsxCards.nth(1)).toContainText("<script>alert('unsafe')</script>");
  await expect(xlsxCards.nth(2)).toContainText("Cảm ơn");
  await expect(xlsxPage.locator("script", { hasText: "unsafe" })).toHaveCount(0);

  expect(storageRequests).toEqual([]);
  expect(serverPayloads.join("\n")).not.toContain("cards.csv");
  expect(serverPayloads.join("\n")).not.toContain("multi-sheet.xlsx");
  expect(serverPayloads.join("\n")).not.toContain("Front,Back");

  await signOut(xlsxPage);
  await signUp(xlsxPage, userBEmail, "Import User B");
  await xlsxPage.goto(userASetUrl);
  await expect(xlsxPage).toHaveURL(userASetUrl);
  await expect(xlsxPage.getByRole("heading", { name: "404" })).toBeVisible();
  await expect(xlsxPage.getByText("Rendered safely")).toHaveCount(0);
  await expect(xlsxPage.getByText("One back")).toHaveCount(0);

  await signOut(xlsxPage);
  await signIn(xlsxPage, userAEmail);
});
