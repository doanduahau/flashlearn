import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { expect, test } from "@playwright/test";

import { signUpAndConfirm, uniqueEmail } from "./support/auth-helpers";
import { localSupabaseAdminRest } from "./support/supabase-api";

const IMPORT_CSV = "tests/fixtures/set-management.csv";
const CLASSROOM_SET_NAME = "Bộ lớp học clone";
const PLAIN_SET_NAME = "Bộ thường clone";
const AUTH_STATE = "tests/e2e/.auth/shared-clone-owner.json";

test.describe("Shared set cloning", () => {
  test.describe.configure({ mode: "serial" });

  let classroomToken = "";
  let plainToken = "";

  test("owner shares a classroom set and a plain set", async ({ page }) => {
    await signUpAndConfirm(page, uniqueEmail("share_clone_owner"));

    await page.goto("/sets/create?source=file");
    await page.getByLabel(/CSV\/XLSX/i).setInputFiles(IMPORT_CSV);
    await page.getByLabel("Tên bộ").fill(CLASSROOM_SET_NAME);
    await page.getByRole("button", { name: /Tạo bộ flashcard/i }).click();
    await expect(page).toHaveURL(/\/sets\/[0-9a-f-]+$/);

    await page.getByRole("button", { name: /^Chia sẻ$/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: /Tạo link chia sẻ/i }).click();
    const classroomUrl = page.getByText(/\/share\/[0-9a-f]{32}/);
    await expect(classroomUrl).toBeVisible();
    classroomToken = (await classroomUrl.textContent())?.match(/[0-9a-f]{32}/)?.[0] ?? "";

    const classroomToggle = page.getByRole("checkbox", { name: /Chế độ lớp học/i });
    await classroomToggle.click();
    await expect(page.getByText(/đây là link lớp học/i)).toBeVisible();
    await page.getByRole("button", { name: /Đóng/i }).click();

    await page.goto("/sets/create?source=file");
    await page.getByLabel(/CSV\/XLSX/i).setInputFiles(IMPORT_CSV);
    await page.getByLabel("Tên bộ").fill(PLAIN_SET_NAME);
    await page.getByRole("button", { name: /Tạo bộ flashcard/i }).click();
    await expect(page).toHaveURL(/\/sets\/[0-9a-f-]+$/);

    await page.getByRole("button", { name: /^Chia sẻ$/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: /Tạo link chia sẻ/i }).click();
    const plainUrl = page.getByText(/\/share\/[0-9a-f]{32}/);
    await expect(plainUrl).toBeVisible();
    plainToken = (await plainUrl.textContent())?.match(/[0-9a-f]{32}/)?.[0] ?? "";
    await page.getByRole("button", { name: /Đóng/i }).click();

    mkdirSync(dirname(AUTH_STATE), { recursive: true });
    await page.context().storageState({ path: AUTH_STATE });
  });

  test("a student clones the classroom link and becomes a member", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await signUpAndConfirm(page, uniqueEmail("share_clone_student"));

    await page.goto(`/share/${classroomToken}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(CLASSROOM_SET_NAME);
    await expect(page.getByRole("button", { name: "Tham gia lớp học" })).toBeVisible();

    await page.getByRole("button", { name: "Tham gia lớp học" }).click();
    await expect(page).toHaveURL(/\/sets\/[0-9a-f-]+$/);
    const cloneId = new URL(page.url()).pathname.split("/").pop() ?? "";

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(CLASSROOM_SET_NAME);
    await expect(page.getByText("Xin chào")).toBeVisible();
    await expect(page.getByText("Hello")).toBeVisible();
    await expect(page.getByText(/2 flashcard/)).toBeVisible();

    const sourceRows = await (
      await localSupabaseAdminRest(`flashcard_sets?select=id&share_token=eq.${classroomToken}`)
    ).json();
    const sourceSetId = sourceRows[0]?.id as string;
    expect(sourceSetId).toBeTruthy();

    const membership = await (
      await localSupabaseAdminRest(
        `shared_set_memberships?select=set_id,clone_set_id&set_id=eq.${sourceSetId}`,
      )
    ).json();
    expect(membership).toHaveLength(1);
    expect((membership[0] as { clone_set_id: string }).clone_set_id).toBe(cloneId);

    await context.close();
  });

  test("a student clones the plain link without becoming a member", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await signUpAndConfirm(page, uniqueEmail("share_clone_student_plain"));

    await page.goto(`/share/${plainToken}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(PLAIN_SET_NAME);
    await expect(page.getByRole("button", { name: "Lưu vào bộ của tôi" })).toBeVisible();

    await page.getByRole("button", { name: "Lưu vào bộ của tôi" }).click();
    await expect(page).toHaveURL(/\/sets\/[0-9a-f-]+$/);

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(PLAIN_SET_NAME);
    await expect(page.getByText("Xin chào")).toBeVisible();

    const sourceRows = await (
      await localSupabaseAdminRest(`flashcard_sets?select=id&share_token=eq.${plainToken}`)
    ).json();
    const sourceSetId = sourceRows[0]?.id as string;
    expect(sourceSetId).toBeTruthy();

    const membership = await (
      await localSupabaseAdminRest(
        `shared_set_memberships?select=set_id,clone_set_id&set_id=eq.${sourceSetId}`,
      )
    ).json();
    expect(membership).toHaveLength(0);

    await context.close();
  });
});
