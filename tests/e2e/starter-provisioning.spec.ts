import { expect, test } from "@playwright/test";

import { signUpAndConfirm, uniqueEmail } from "./support/auth-helpers";

test.skip(
  process.env.CAPYSTUDY_STARTER_PROVISIONING_ENABLED !== "true",
  "Starter provisioning E2E requires the provisioning feature flag.",
);

test("confirmed user receives the three editable starter sets", async ({ page }) => {
  await signUpAndConfirm(page, uniqueEmail("starter_provision"));

  await page.goto("/sets");
  await expect(
    page.getByText("CapyStudy đã chuẩn bị 3 bộ flashcard để bạn bắt đầu học ngay."),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("CapyStudy đã chuẩn bị 3 bộ flashcard để bạn bắt đầu học ngay."),
  ).toHaveCount(0);

  await page.goto("/sets/library");
  await expect(page.getByText("Từ vựng tiếng Anh: Trái cây", { exact: true })).toBeVisible();
  await expect(page.getByText("Từ vựng tiếng Anh: Động vật", { exact: true })).toBeVisible();
  await expect(page.getByText("Kiến thức khoa học và xã hội", { exact: true })).toBeVisible();

  await page.getByText("Từ vựng tiếng Anh: Trái cây", { exact: true }).click();
  await expect(page).toHaveURL(/\/sets\/[0-9a-f-]+$/);
  await expect(page.getByText(/50 flashcard/)).toBeVisible();
});
