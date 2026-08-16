import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { expect, test } from "@playwright/test";

import { signUpAndConfirm, uniqueEmail } from "./support/auth-helpers";
import { authSubject, localSupabaseAdminRest } from "./support/supabase-api";

const IMPORT_CSV = "tests/fixtures/set-management.csv";
const CLASSROOM_SET_NAME = "Bộ lớp học thống kê";
const PLAIN_SET_NAME = "Bộ thường thống kê";
const AUTH_STATE = "tests/e2e/.auth/stats-owner.json";

test.describe("Classroom stats leaderboard", () => {
  test.describe.configure({ mode: "serial" });

  let classroomSetId = "";
  let plainSetId = "";

  test("owner enables classroom mode and seeds a member with match activity", async ({ page }) => {
    await signUpAndConfirm(page, uniqueEmail("stats_owner"));

    await page.goto("/sets/create?source=file");
    await page.getByLabel(/CSV\/XLSX/i).setInputFiles(IMPORT_CSV);
    await page.getByLabel("Tên bộ").fill(CLASSROOM_SET_NAME);
    await page.getByRole("button", { name: /Tạo bộ flashcard/i }).click();
    await expect(page).toHaveURL(/\/sets\/[0-9a-f-]+$/);
    classroomSetId = new URL(page.url()).pathname.split("/").pop() ?? "";

    await page.getByRole("button", { name: /^Chia sẻ$/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: /Tạo link chia sẻ/i }).click();
    const classroomUrl = page.getByText(/\/share\/[0-9a-f]{32}/);
    await expect(classroomUrl).toBeVisible();
    const classroomToken = (await classroomUrl.textContent())?.match(/[0-9a-f]{32}/)?.[0] ?? "";
    expect(classroomToken).toMatch(/^[0-9a-f]{32}$/);

    const classroomToggle = page.getByRole("checkbox", { name: /Chế độ lớp học/i });
    await classroomToggle.click();
    await expect(page.getByText(/đây là link lớp học/i)).toBeVisible();
    await page.getByRole("button", { name: /Đóng/i }).click();

    await page.goto("/sets/create?source=file");
    await page.getByLabel(/CSV\/XLSX/i).setInputFiles(IMPORT_CSV);
    await page.getByLabel("Tên bộ").fill(PLAIN_SET_NAME);
    await page.getByRole("button", { name: /Tạo bộ flashcard/i }).click();
    await expect(page).toHaveURL(/\/sets\/[0-9a-f-]+$/);
    plainSetId = new URL(page.url()).pathname.split("/").pop() ?? "";

    await page.getByRole("button", { name: /^Chia sẻ$/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: /Tạo link chia sẻ/i }).click();
    await expect(page.getByText(/\/share\/[0-9a-f]{32}/)).toBeVisible();
    await page.getByRole("button", { name: /Đóng/i }).click();

    mkdirSync(dirname(AUTH_STATE), { recursive: true });
    await page.context().storageState({ path: AUTH_STATE });

    const teacherId = await authSubject(page.context());
    expect(teacherId).toBeTruthy();

    const sourceRows = await (
      await localSupabaseAdminRest(`flashcard_sets?select=id&share_token=eq.${classroomToken}`)
    ).json();
    const sourceSetId = (sourceRows[0] as { id: string } | undefined)?.id;
    expect(sourceSetId).toBeTruthy();

    const cloneSet = await localSupabaseAdminRest("flashcard_sets", {
      method: "POST",
      body: JSON.stringify({
        user_id: teacherId,
        name: "Clone học sinh",
      }),
      headers: { Prefer: "return=representation" },
    });
    const cloneBody = (await cloneSet.json()) as { id: string }[];
    const cloneSetId = cloneBody[0]?.id;
    expect(cloneSetId).toBeTruthy();

    const membership = await localSupabaseAdminRest("shared_set_memberships", {
      method: "POST",
      body: JSON.stringify({
        set_id: sourceSetId,
        member_user_id: teacherId,
        clone_set_id: cloneSetId,
      }),
      headers: { Prefer: "return=representation" },
    });
    expect(membership.status).toBe(201);

    const completedAt = new Date().toISOString();
    const match = await localSupabaseAdminRest("match_attempts", {
      method: "POST",
      body: JSON.stringify({
        user_id: teacherId,
        source_set_ids: [cloneSetId],
        source_collection_ids: [],
        source_all: false,
        total_pairs: 10,
        correct_pair_count: 8,
        incorrect_attempt_count: 2,
        elapsed_ms: 12000,
        started_at: completedAt,
        completed_at: completedAt,
      }),
      headers: { Prefer: "return=representation" },
    });
    expect(match.status).toBe(201);
  });

  test("owner sees the stats button and leaderboard for the classroom set only", async ({
    browser,
  }) => {
    const context = await browser.newContext({ storageState: AUTH_STATE });
    const page = await context.newPage();

    await page.goto(`/sets/${classroomSetId}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(CLASSROOM_SET_NAME);

    const statsButton = page.getByRole("button", { name: /Thống kê học sinh/i });
    await expect(statsButton).toBeVisible();
    await statsButton.click();
    await expect(page.getByRole("dialog", { name: /Thống kê lớp học/i })).toBeVisible();
    await expect(page.getByText("Chỉ bạn xem được bảng này.")).toBeVisible();
    const dialog = page.getByRole("dialog", { name: /Thống kê lớp học/i });
    await expect(dialog.getByText("Set Mgmt User")).toBeVisible();
    await expect(dialog.getByText("10")).toBeVisible();
    await expect(dialog.getByText("80%")).toBeVisible();

    await page.goto(`/sets/${plainSetId}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(PLAIN_SET_NAME);
    await expect(page.getByRole("button", { name: /Thống kê học sinh/i })).toHaveCount(0);

    await context.close();
  });
});
