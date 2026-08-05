import { expect, test } from "@playwright/test";

const TEST_PASSWORD = "TestPassword123!";
const EMAIL_DOMAIN = "test.flashlearn.dev";

function uniqueEmail(): string {
  return `auth_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@${EMAIL_DOMAIN}`;
}

async function signUpAndConfirm(page: import("@playwright/test").Page, email: string) {
  const browserContext = page.context();

  await page.goto("/sign-up");
  await page.getByLabel("Tên hiển thị").fill("Auth Test");
  await page.getByLabel("Email").fill(email);
  await page.locator("#password").fill(TEST_PASSWORD);
  await page.locator("#confirmPassword").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: /đăng ký/i }).click();

  await page.waitForURL("**/check-email");

  // Open Mailpit in a new page to get the confirmation email
  const mailPage = await browserContext.newPage();
  await mailPage.goto("http://127.0.0.1:54324");
  await mailPage.waitForTimeout(2000);

  // Search for the email by typing the email address into the search box
  const searchBox = mailPage.locator('input[placeholder="Search mailbox"]');
  await searchBox.fill(email);
  await mailPage.waitForTimeout(1000);

  // Click on the email row
  const emailLink = mailPage.locator(`text=${email}`).first();
  await emailLink.click();

  // Wait for email content to render
  await mailPage.waitForTimeout(2000);

  // Extract the confirmation link href from the email
  // The link may contain either token_hash or code parameter
  const confirmLink = mailPage.locator('a[href*="auth/confirm"]').first();
  await confirmLink.waitFor({ state: "attached", timeout: 10000 });
  const confirmHref = await confirmLink.getAttribute("href");

  if (!confirmHref) {
    throw new Error("Could not find confirmation link in email");
  }

  // Navigate directly to the confirmation link
  await page.goto(confirmHref);
}

test.describe("Authentication Flow", () => {
  test("sign-up, confirm, dashboard, sign-out flow", async ({ page }) => {
    const email = uniqueEmail();

    await signUpAndConfirm(page, email);

    // Verify user is on dashboard
    expect(page.url()).toContain("/dashboard");

    // Verify display name is shown
    await expect(page.getByText("Auth Test").first()).toBeVisible();

    // Sign out
    await page.getByRole("button", { name: /đăng xuất/i }).click();
    await page.waitForURL(/\/sign-in$/);

    // Verify dashboard redirects to sign-in
    await page.goto("/dashboard");
    await page.waitForURL(/\/sign-in\?next=/);
    expect(new URL(page.url()).searchParams.get("next")).toBe("/dashboard");
  });

  test("sign-in with correct credentials succeeds", async ({ page }) => {
    const email = uniqueEmail();

    // Sign up and confirm first
    await signUpAndConfirm(page, email);
    expect(page.url()).toContain("/dashboard");

    // Sign out
    await page.getByRole("button", { name: /đăng xuất/i }).click();
    await page.waitForURL(/\/sign-in$/);

    // Sign in again
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill(email);
    await page.locator("#password").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: /đăng nhập/i }).click();

    // Should redirect to dashboard
    await page.waitForURL(/\/dashboard$/);
    await expect(page.getByText("Auth Test").first()).toBeVisible();
  });

  test("sign-in with incorrect credentials fails generically", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill("nonexistent@example.com");
    await page.locator("#password").fill("wrongpassword");
    await page.getByRole("button", { name: /đăng nhập/i }).click();

    // Should see an error message
    await page.waitForURL(/\/sign-in\?error=/);
    const errorElement = page.locator('[role="alert"]').first();
    await expect(errorElement).toBeVisible();
  });

  test("sign-out and sign-in again works correctly", async ({ page }) => {
    const email = uniqueEmail();

    await signUpAndConfirm(page, email);
    expect(page.url()).toContain("/dashboard");

    // Sign out
    await page.getByRole("button", { name: /đăng xuất/i }).click();
    await page.waitForURL(/\/sign-in$/);

    // Sign in again
    await page.getByLabel("Email").fill(email);
    await page.locator("#password").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: /đăng nhập/i }).click();

    // Should redirect to dashboard
    await page.waitForURL(/\/dashboard$/);
    await expect(page.getByText("Auth Test").first()).toBeVisible();
  });

  test("safe next parameter is restored after sign-in", async ({ page }) => {
    const email = uniqueEmail();

    await signUpAndConfirm(page, email);
    await page.waitForURL(/\/dashboard$/);

    // Sign out
    await page.getByRole("button", { name: /đăng xuất/i }).click();
    await page.waitForURL(/\/sign-in$/);

    // Try to access dashboard - should redirect to sign-in with next=dashboard
    await page.goto("/dashboard");
    await page.waitForURL(/\/sign-in\?next=/);
    expect(new URL(page.url()).searchParams.get("next")).toBe("/dashboard");

    // Sign in
    await page.getByLabel("Email").fill(email);
    await page.locator("#password").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: /đăng nhập/i }).click();

    // Should redirect to dashboard (the safe next parameter)
    await page.waitForURL(/\/dashboard$/);
  });

  test("malicious external next values are rejected", async ({ page }) => {
    const email = uniqueEmail();

    await signUpAndConfirm(page, email);
    await page.waitForURL(/\/dashboard$/);

    // Sign out
    await page.getByRole("button", { name: /đăng xuất/i }).click();
    await page.waitForURL(/\/sign-in$/);

    // Try to sign in with a malicious next parameter
    await page.goto("/sign-in?next=https://evil.com");
    await page.getByLabel("Email").fill(email);
    await page.locator("#password").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: /đăng nhập/i }).click();

    // Should redirect to dashboard, not evil.com
    await page.waitForURL(/\/dashboard$/);
    expect(page.url()).not.toContain("evil.com");
  });

  test("malicious protocol-relative next values are rejected", async ({ page }) => {
    const email = uniqueEmail();

    await signUpAndConfirm(page, email);
    await page.waitForURL(/\/dashboard$/);

    // Sign out
    await page.getByRole("button", { name: /đăng xuất/i }).click();
    await page.waitForURL(/\/sign-in$/);

    // Try to sign in with a protocol-relative next parameter
    await page.goto("/sign-in?next=//evil.com");
    await page.getByLabel("Email").fill(email);
    await page.locator("#password").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: /đăng nhập/i }).click();

    // Should redirect to dashboard, not evil.com
    await page.waitForURL(/\/dashboard$/);
    expect(page.url()).not.toContain("evil.com");
  });
});
