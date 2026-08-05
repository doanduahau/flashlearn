import { expect, type Page, test } from "@playwright/test";

const APP_ORIGIN = "http://127.0.0.1:3000";
const TEST_PASSWORD = "TestPassword123!";

function uniqueEmail(): string {
  return `no_confirm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@test.flashlearn.dev`;
}

async function signIn(page: Page, email: string): Promise<void> {
  await page.getByLabel("Email").fill(email);
  await page.locator("#password").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: /đăng nhập/i }).click();
}

test("sign-up without email confirmation creates a persistent session", async ({
  page,
  context,
}) => {
  const email = uniqueEmail();

  await page.goto("/sign-up");
  await page.getByLabel("Tên hiển thị").fill("No Confirm Test");
  await page.getByLabel("Email").fill(email);
  await page.locator("#password").fill(TEST_PASSWORD);
  await page.locator("#confirmPassword").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: /đăng ký/i }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  expect((await context.cookies(APP_ORIGIN)).some(({ name }) => name.includes("auth-token"))).toBe(
    true,
  );

  await page.reload();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole("button", { name: /đăng xuất/i }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  expect((await context.cookies(APP_ORIGIN)).some(({ name }) => name.includes("auth-token"))).toBe(
    false,
  );

  await signIn(page, email);
  await expect(page).toHaveURL(/\/dashboard$/);
});
