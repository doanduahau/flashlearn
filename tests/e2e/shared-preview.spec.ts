import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { expect, type Page, test } from "@playwright/test";

import { signUpAndConfirm, uniqueEmail } from "./support/auth-helpers";

const IMPORT_CSV = "tests/fixtures/set-management.csv";
const SET_NAME = "Bộ preview chia sẻ";
const AUTH_STATE = "tests/e2e/.auth/shared-preview-owner.json";

test.describe("Public share preview", () => {
  test.describe.configure({ mode: "serial" });

  let shareToken = "";

  test("owner shares a set with classroom mode and the preview shows set, cards and banner", async ({
    page,
  }) => {
    await signUpAndConfirm(page, uniqueEmail("share_preview_owner"));

    await page.goto("/sets/create?source=file");
    await page.getByLabel(/CSV\/XLSX/i).setInputFiles(IMPORT_CSV);
    await page.getByLabel("Tên bộ").fill(SET_NAME);
    await page.getByRole("button", { name: /Tạo bộ flashcard/i }).click();
    await expect(page).toHaveURL(/\/sets\/[0-9a-f-]+$/);

    await page.getByRole("button", { name: /^Chia sẻ$/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: /Tạo link chia sẻ/i }).click();

    const shareUrl = page.getByText(/\/share\/[0-9a-f]{32}/);
    await expect(shareUrl).toBeVisible();
    const urlText = await shareUrl.textContent();
    const token = urlText?.match(/[0-9a-f]{32}/)?.[0];
    expect(token).toMatch(/^[0-9a-f]{32}$/);
    shareToken = token ?? "";

    const classroomToggle = page.getByRole("checkbox", { name: /Chế độ lớp học/i });
    await classroomToggle.click();
    await expect(page.getByText(/đây là link lớp học/i)).toBeVisible();

    await page.getByRole("button", { name: /Đóng/i }).click();
    mkdirSync(dirname(AUTH_STATE), { recursive: true });
    await page.context().storageState({ path: AUTH_STATE });

    const anonContext = await page.context().browser()!.newContext();
    const anonPage = await anonContext.newPage();
    await expectAnonPreview(anonPage, shareToken);
    await anonContext.close();
  });

  test("unknown token shows the missing-link state", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(`/share/${"a".repeat(32)}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Link không tồn tại hoặc đã bị tắt chia sẻ",
    );
    await context.close();
  });
});

async function expectAnonPreview(page: Page, token: string): Promise<void> {
  await page.goto(`/share/${token}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(SET_NAME);
  await expect(page.getByText(/2 flashcard/)).toBeVisible();
  await expect(page.getByText("Xin chào")).toBeVisible();
  await expect(page.getByText("Hello")).toBeVisible();
  await expect(page.getByText(/đây là link lớp học/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /Chia sẻ/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Xóa/i })).toHaveCount(0);
}
