import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { expect, test } from "@playwright/test";

import { signUpAndConfirm, uniqueEmail } from "./support/auth-helpers";

const IMPORT_CSV = "tests/fixtures/set-management.csv";
const SET_NAME = "Bộ chia sẻ A";
const AUTH_STATE = "tests/e2e/.auth/share-owner.json";

test.describe("Set sharing dialog", () => {
  test.describe.configure({ mode: "serial" });

  let setId = "";

  test("Owner creates a share link, copies it, enables classroom mode, then revokes it", async ({
    page,
  }) => {
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await signUpAndConfirm(page, uniqueEmail("share_owner"));

    await page.goto("/sets/create?source=file");
    await page.getByLabel(/CSV\/XLSX/i).setInputFiles(IMPORT_CSV);
    await page.getByLabel("Tên bộ").fill(SET_NAME);
    await page.getByRole("button", { name: /Tạo bộ flashcard/i }).click();

    await expect(page).toHaveURL(/\/sets\/[0-9a-f-]+$/);
    setId = new URL(page.url()).pathname.split("/").pop() ?? "";
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(SET_NAME);

    await page.getByRole("button", { name: /^Chia sẻ$/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText(/link để học sinh xem/i)).toBeVisible();

    await page.getByRole("button", { name: /Tạo link chia sẻ/i }).click();
    const shareUrl = page.getByText(/\/share\/[0-9a-f]{32}/);
    await expect(shareUrl).toBeVisible();

    await page.getByRole("button", { name: /Sao chép link/i }).click();
    await expect(page.getByText("Đã sao chép!")).toBeVisible();

    const classroomToggle = page.getByRole("checkbox", { name: /Chế độ lớp học/i });
    await expect(classroomToggle).toBeVisible();
    await classroomToggle.click();
    await expect(page.getByText(/đây là link lớp học/i)).toBeVisible();

    await page.getByRole("button", { name: /Tắt chia sẻ/i }).click();
    await expect(page.getByText(/tắt chia sẻ link này\?/i)).toBeVisible();
    await page.getByRole("button", { name: /^Tắt$/i }).click();
    await expect(page.getByText(/link để học sinh xem/i)).toBeVisible();

    await page.getByRole("button", { name: /Tạo link chia sẻ/i }).click();
    await expect(shareUrl).toBeVisible();

    mkdirSync(dirname(AUTH_STATE), { recursive: true });
    await page.context().storageState({ path: AUTH_STATE });
  });

  test("Owner sees the shared state persisted after revisiting", async ({ browser }) => {
    const context = await browser.newContext({ storageState: AUTH_STATE });
    const page = await context.newPage();

    await page.goto(`/sets/${setId}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(SET_NAME);
    await page.getByRole("button", { name: /^Chia sẻ$/i }).click();
    await expect(page.getByText(/\/share\/[0-9a-f]{32}/)).toBeVisible();

    await context.close();
  });
});
