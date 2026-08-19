import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { expect, test } from "@playwright/test";

import { signUpAndConfirm, uniqueEmail } from "./support/auth-helpers";
import { authSubject, supabaseRest } from "./support/supabase-api";

const AUTH_STATE = "tests/e2e/.auth/profile-a.json";
const A_DISPLAY_NAME = "Nguyễn Văn A";
const A_DISPLAY_NAME_DURING_COOLDOWN = "Nguyễn Văn A (đã xác nhận)";
const A_TIMEZONE = "Pacific/Pago_Pago";

test.describe("Profile settings", () => {
  test.describe.configure({ mode: "serial" });

  test("User A views the read-only email and updates profile", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const email = uniqueEmail("profile_a");
    await signUpAndConfirm(page, email);

    await page.goto("/profile?tab=settings");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Cá nhân");

    const emailInput = page.getByLabel("Email");
    await expect(emailInput).toHaveValue(email);
    await expect(emailInput).toHaveAttribute("readonly", "");
    await expect(emailInput).toHaveAttribute("aria-readonly", "true");
    await expect(page.getByText("Email không thể thay đổi.")).toBeVisible();
    await expect(page.getByText(/Giờ địa phương ở Asia\/Ho_Chi_Minh/)).toBeVisible();

    await page.getByLabel("Tên hiển thị").fill(A_DISPLAY_NAME);
    await page.getByRole("button", { name: /Lưu thay đổi/ }).click();
    await expect(page.getByText("Đã lưu thay đổi.", { exact: true })).toBeVisible();

    await page.goto("/profile?tab=settings");
    await page.getByLabel("Múi giờ").selectOption(A_TIMEZONE);
    await page.getByRole("button", { name: /Lưu thay đổi/ }).click();
    await expect(page.getByText("Đã lưu thay đổi.", { exact: true })).toBeVisible();
    await expect(page.getByText(/Có thể đổi múi giờ lại sau/)).toBeVisible();
    await expect(page.getByLabel("Múi giờ")).toBeDisabled();

    await page.getByLabel("Tên hiển thị").fill(A_DISPLAY_NAME_DURING_COOLDOWN);
    await page.getByRole("button", { name: /Lưu thay đổi/ }).click();
    await expect(page.getByText("Đã lưu thay đổi.", { exact: true })).toBeVisible();

    await page.reload();
    await expect(page.getByLabel("Tên hiển thị")).toHaveValue(A_DISPLAY_NAME_DURING_COOLDOWN);
    await expect(page.getByLabel("Múi giờ")).toHaveValue(A_TIMEZONE);

    await page.goto("/dashboard");
    await expect(
      page.getByRole("complementary").getByText(A_DISPLAY_NAME_DURING_COOLDOWN),
    ).toBeVisible();

    await page.goto("/profile?tab=statistics");
    await expect(page.getByText(new RegExp(`Theo múi giờ ${A_TIMEZONE}`))).toBeVisible();

    mkdirSync(dirname(AUTH_STATE), { recursive: true });
    await context.storageState({ path: AUTH_STATE });
    await context.close();
  });

  test("a direct request with an invalid timezone is rejected", async ({ browser }) => {
    const context = await browser.newContext({ storageState: AUTH_STATE });

    const response = await supabaseRest(context, "rpc/update_profile", {
      method: "POST",
      body: JSON.stringify({ p_display_name: "X", p_timezone: "Mars/Olympus" }),
    });
    expect(response.ok).toBe(false);

    await context.close();
  });

  test("User B cannot update User A's profile", async ({ browser }) => {
    const bContext = await browser.newContext();
    const bPage = await bContext.newPage();
    await signUpAndConfirm(bPage, uniqueEmail("profile_b"));

    const aContext = await browser.newContext({ storageState: AUTH_STATE });
    const aUserId = await authSubject(aContext);

    const patch = await supabaseRest(bContext, `profiles?id=eq.${aUserId}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ display_name: "Hacked" }),
    });
    expect(patch.status).toBeGreaterThanOrEqual(400);

    const aPage = await aContext.newPage();
    await aPage.goto("/profile?tab=settings");
    await expect(aPage.getByLabel("Tên hiển thị")).toHaveValue(A_DISPLAY_NAME_DURING_COOLDOWN);
    await expect(aPage.getByLabel("Múi giờ")).toHaveValue(A_TIMEZONE);

    await aContext.close();
    await bContext.close();
  });
});
