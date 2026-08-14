import { expect, type Page, test } from "@playwright/test";

import { signUpAndConfirm, uniqueEmail } from "./support/auth-helpers";

const MOBILE = { width: 390, height: 844 };
const CSV = "tests/fixtures/smart-review-24-cards.csv";

async function importSet(page: Page, name: string): Promise<void> {
  await page.goto("/sets/create?source=file");
  await page.getByLabel(/CSV\/XLSX/i).setInputFiles(CSV);
  await page.getByLabel("Tên bộ").fill(name);
  await page.getByRole("button", { name: /Tạo bộ flashcard/i }).click();
  await expect(page).toHaveURL(/\/sets\/[0-9a-f-]+$/);
}

async function pasteRows(page: Page, name: string, rows: string[]): Promise<void> {
  await page.goto("/sets/create");
  await page.locator("#paste-textarea").fill(rows.join("\n"));
  await page.getByRole("button", { name: "Phân tích" }).click();
  await expect(page.getByRole("button", { name: /Tạo bộ flashcard/i })).toBeVisible();
  await page.getByLabel("Tên bộ").fill(name);
  await page.getByRole("button", { name: /Tạo bộ flashcard/i }).click();
  await expect(page).toHaveURL(/\/sets\/[0-9a-f-]+$/);
}

async function createCards(page: Page, name: string, count: number): Promise<void> {
  const rows = Array.from({ length: count }, (_, i) => `Front ${i}\tBack ${i}`);
  await pasteRows(page, name, rows);
}

test.describe("Capy Runner setup", () => {
  test("difficulty selector shows Dễ/Vừa/Khó with Vừa selected by default", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await signUpAndConfirm(page, uniqueEmail("runner_difficulty"));

    await page.goto("/runner");

    await expect(page.getByRole("heading", { name: "Capy Runner" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Vừa học vừa chơi" })).toHaveCount(0);

    for (const label of ["Dễ", "Vừa", "Khó"]) {
      await expect(page.getByRole("button", { name: label })).toBeVisible();
    }
    await expect(page.getByRole("button", { name: "Vừa" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText(/2 mạng · 3 giây\/đáp án/)).toBeVisible();
  });

  test("offers 12/18/24, starts a session, and shows the first question", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await signUpAndConfirm(page, uniqueEmail("runner_full"));
    await importSet(page, "Bộ Runner");

    await page.goto("/runner");
    await expect(page.getByRole("button", { name: "12 câu" })).toBeVisible();
    await expect(page.getByRole("button", { name: "18 câu" })).toBeVisible();
    await expect(page.getByRole("button", { name: "24 câu" })).toBeVisible();

    await page.getByRole("button", { name: "Bắt đầu Runner" }).click();
    await expect(page).toHaveURL(/\/runner\/session\?sessionId=[0-9a-f-]+/);

    await expect(page.getByText("Câu 1 / 12")).toBeVisible();
    await expect(page.getByText(/Vừa · 2 mạng/)).toBeVisible();
    await expect(page.getByText("Chạm để bắt đầu")).toBeVisible();
    await expect(page.getByText(/Smart prompt \d+/)).toBeVisible();
  });

  test("with 7 cards shows the pool message and disables Start", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await signUpAndConfirm(page, uniqueEmail("runner_seven"));
    await createCards(page, "Bộ 7 thẻ", 7);

    await page.goto("/runner");
    await expect(page.getByText("Không đủ thẻ hợp lệ để bắt đầu Runner.")).toBeVisible();
    await expect(page.getByRole("button", { name: "12 câu" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Bắt đầu Runner" })).toBeDisabled();
  });

  test("with duplicate backs shows the eligibility notice and no startable count", async ({
    page,
  }) => {
    await page.setViewportSize(MOBILE);
    await signUpAndConfirm(page, uniqueEmail("runner_dupe"));
    await pasteRows(page, "Bộ trùng đáp án", [
      "Front A\tSHARED",
      "Front B\tSHARED",
      "Front C\tSHARED",
      "Front D\tUNIQUE",
    ]);

    await page.goto("/runner");
    await expect(
      page.getByText("Một số thẻ bị ẩn vì không đủ đáp án sai khác trong thư viện."),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "12 câu" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Bắt đầu Runner" })).toBeDisabled();
  });

  test("redirects to /runner when the session id is missing or unknown", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await signUpAndConfirm(page, uniqueEmail("runner_redirect"));

    await page.goto("/runner/session");
    await expect(page).toHaveURL(/\/runner$/);

    await page.goto("/runner/session?sessionId=00000000-0000-0000-0000-000000000000");
    await expect(page).toHaveURL(/\/runner$/);
  });

  test("has no horizontal overflow on /runner and /runner/session at 390px", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await signUpAndConfirm(page, uniqueEmail("runner_overflow"));
    await importSet(page, "Bộ Runner overflow");

    await page.goto("/runner");
    const setupOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(setupOverflow).toBe(false);

    await page.getByRole("button", { name: "Bắt đầu Runner" }).click();
    await expect(page).toHaveURL(/\/runner\/session\?sessionId=[0-9a-f-]+/);
    const sessionOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(sessionOverflow).toBe(false);
  });
});
