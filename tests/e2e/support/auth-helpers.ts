import { expect, type Page } from "@playwright/test";

import { mailpitUrl } from "./local-endpoints";

export const TEST_PASSWORD = "TestPassword123!";
const EMAIL_DOMAIN = "test.capystudy.dev";

export function uniqueEmail(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@${EMAIL_DOMAIN}`;
}

export async function signUpAndConfirm(page: Page, email: string): Promise<void> {
  await page.goto("/sign-up");
  await page.getByLabel("Tên hiển thị").fill("Set Mgmt User");
  await page.getByLabel("Email").fill(email);
  await page.locator("#password").fill(TEST_PASSWORD);
  await page.locator("#confirmPassword").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: /đăng ký/i }).click();

  await expect(page).toHaveURL(/\/check-email$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Kiểm tra email");

  const mailPage = await page.context().newPage();
  await mailPage.goto(mailpitUrl());

  const searchBox = mailPage.locator('input[placeholder="Search mailbox"]');
  await expect(searchBox).toBeVisible();
  await searchBox.fill(email);

  const emailRow = mailPage.locator(`text=${email}`).first();
  await emailRow.waitFor({ state: "visible", timeout: 20_000 });
  await emailRow.click();

  const confirmLink = mailPage.locator('a[href*="auth/confirm"]').first();
  await confirmLink.waitFor({ state: "attached", timeout: 30_000 });
  const rawHref = await confirmLink.getAttribute("href");

  await mailPage.close();

  if (!rawHref) {
    throw new Error("Confirmation link not found in Mailpit");
  }

  const parsedUrl = new URL(rawHref);
  const currentOrigin = new URL(page.url()).origin;
  const redirectTo = parsedUrl.searchParams.get("redirect_to");
  if (redirectTo) {
    const parsedRedirect = new URL(redirectTo);
    parsedUrl.searchParams.set(
      "redirect_to",
      `${currentOrigin}${parsedRedirect.pathname}${parsedRedirect.search}`,
    );
  }
  const confirmUrl = `${parsedUrl.origin}${parsedUrl.pathname}${parsedUrl.search}`;

  await page.goto(confirmUrl);
  await expect(page).toHaveURL(/\/dashboard$/);
}
