import { expect, type Page, test } from "@playwright/test";

const TEST_PASSWORD = "TestPassword123!";
const EMAIL_DOMAIN = "test.flashlearn.dev";
const MAILPIT_URL = "http://127.0.0.1:54324";
const APP_ORIGIN = "http://127.0.0.1:3000";

function uniqueEmail(): string {
  return `auth_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@${EMAIL_DOMAIN}`;
}

async function submitSignUp(page: Page, email: string): Promise<void> {
  await page.goto("/sign-up");
  await page.getByLabel("Tên hiển thị").fill("Auth Test");
  await page.getByLabel("Email").fill(email);
  await page.locator("#password").fill(TEST_PASSWORD);
  await page.locator("#confirmPassword").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: /đăng ký/i }).click();
}

async function openConfirmationLink(page: Page, email: string): Promise<string> {
  const mailPage = await page.context().newPage();
  await mailPage.goto(MAILPIT_URL);

  const searchBox = mailPage.locator('input[placeholder="Search mailbox"]');
  await expect(searchBox).toBeVisible();
  await searchBox.fill(email);

  const emailRow = mailPage.locator(`text=${email}`).first();
  await emailRow.waitFor({ state: "visible", timeout: 20_000 });
  await emailRow.click();

  const confirmLink = mailPage.locator('a[href*="auth/confirm"]').first();
  await confirmLink.waitFor({ state: "attached", timeout: 30_000 });
  const href = await confirmLink.getAttribute("href");

  await mailPage.close();

  if (!href) {
    throw new Error("Confirmation link not found in Mailpit");
  }
  return href;
}

async function confirmEmail(page: Page, email: string): Promise<void> {
  const href = await openConfirmationLink(page, email);

  expect(new URL(href).origin).toBe(APP_ORIGIN);

  await page.goto(href);
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function signUpAndConfirm(page: Page, email: string): Promise<void> {
  await submitSignUp(page, email);

  await expect(page).toHaveURL(/\/check-email$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Kiểm tra email");
  await confirmEmail(page, email);

  await expect(page).toHaveURL(/\/dashboard$/);
}

async function signOut(page: Page): Promise<void> {
  await page.getByRole("button", { name: /đăng xuất/i }).click();
  await page.waitForURL(/\/sign-in$/);
}

async function signIn(page: Page, email: string): Promise<void> {
  await page.getByLabel("Email").fill(email);
  await page.locator("#password").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: /đăng nhập/i }).click();
}

async function assertSessionCookieForAppOrigin(page: Page): Promise<void> {
  const cookies = await page.context().cookies(APP_ORIGIN);
  const hasSessionCookie = cookies.some((cookie) => cookie.name.includes("auth-token"));
  expect(hasSessionCookie).toBe(true);
}

test.describe("Authentication Flow", () => {
  test.describe.configure({ mode: "serial" });

  test("sign-up with email confirmation enabled", async ({ page }) => {
    const email = uniqueEmail();

    await signUpAndConfirm(page, email);
    await assertSessionCookieForAppOrigin(page);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Dashboard");
  });

  test("authenticated user is redirected from /sign-in to /dashboard", async ({ page }) => {
    const email = uniqueEmail();

    await signUpAndConfirm(page, email);

    await page.goto("/sign-in");
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("authenticated user is redirected from /sign-up to /dashboard", async ({ page }) => {
    const email = uniqueEmail();

    await signUpAndConfirm(page, email);

    await page.goto("/sign-up");
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("signing out makes guest pages accessible again", async ({ page }) => {
    const email = uniqueEmail();

    await signUpAndConfirm(page, email);
    await signOut(page);

    await page.goto("/sign-in");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Đăng nhập");

    await page.goto("/sign-up");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tạo tài khoản");

    await page.goto("/dashboard");
    await page.waitForURL(/\/sign-in\?next=/);
    expect(new URL(page.url()).searchParams.get("next")).toBe("/dashboard");
  });

  test("user can sign in again after signing out", async ({ page }) => {
    const email = uniqueEmail();

    await signUpAndConfirm(page, email);
    await signOut(page);

    await page.goto("/sign-in");
    await signIn(page, email);

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Dashboard");
  });

  test("safe next parameter is restored after sign in", async ({ page }) => {
    const email = uniqueEmail();

    await signUpAndConfirm(page, email);
    await signOut(page);

    await page.goto("/dashboard");
    await page.waitForURL(/\/sign-in\?next=/);
    expect(new URL(page.url()).searchParams.get("next")).toBe("/dashboard");

    await signIn(page, email);

    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("malicious external next values are rejected", async ({ page }) => {
    const email = uniqueEmail();

    await signUpAndConfirm(page, email);
    await signOut(page);

    await page.goto("/sign-in?next=https://evil.com");
    await signIn(page, email);

    await expect(page).toHaveURL(/\/dashboard$/);
    expect(page.url()).not.toContain("evil.com");
  });

  test("malicious protocol-relative next values are rejected", async ({ page }) => {
    const email = uniqueEmail();

    await signUpAndConfirm(page, email);
    await signOut(page);

    await page.goto("/sign-in?next=//evil.com");
    await signIn(page, email);

    await expect(page).toHaveURL(/\/dashboard$/);
    expect(page.url()).not.toContain("evil.com");
  });

  test("sign-in with incorrect credentials fails generically", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill("nonexistent@example.com");
    await page.locator("#password").fill("wrongpassword");
    await page.getByRole("button", { name: /đăng nhập/i }).click();

    await page.waitForURL(/\/sign-in\?error=/);
    const errorElement = page.locator('[role="alert"]').first();
    await expect(errorElement).toBeVisible();
  });

  test("unknown route remains 404 for authenticated user", async ({ page }) => {
    const email = uniqueEmail();

    await signUpAndConfirm(page, email);

    const response = await page.goto("/unknown-route-12345");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("404");
  });
});
