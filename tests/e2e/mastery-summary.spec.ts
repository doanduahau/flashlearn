import { expect, type Page, test } from "@playwright/test";

import { signUpAndConfirm, uniqueEmail } from "./support/auth-helpers";

const MOBILE = { width: 390, height: 844 };
const PAGINATION_CSV = "tests/fixtures/pagination-cards.csv";

async function createSetWithCard(page: Page, name: string) {
  await page.goto("/sets?create=manual");
  await page.getByLabel("Tên bộ").fill(name);
  await page.getByLabel("Mặt trước").fill("Trước");
  await page.getByLabel("Mặt sau").fill("Sau");
  await page.getByRole("button", { name: "Tạo bộ" }).click();
  await expect(page).toHaveURL(/\/sets\/[0-9a-f-]+$/);
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
}

test.describe("Mastery summary", () => {
  test("dashboard shows a compact learning-status summary without raw mastery percentage", async ({
    page,
  }) => {
    await page.setViewportSize(MOBILE);
    await signUpAndConfirm(page, uniqueEmail("summary_dash"));
    await createSetWithCard(page, "Bộ tổng hợp");

    await page.goto("/dashboard");

    const summary = page.getByRole("region", { name: "Tóm tắt trạng thái học" });
    await expect(summary).toBeVisible();
    await expect(summary.getByText("Chưa học", { exact: true })).toBeVisible();
    await expect(summary.getByText("1", { exact: true })).toBeVisible();
    await expect(summary.getByRole("button", { name: "Ôn ngay" })).toHaveCount(0);
    await expect(summary.getByText(/%/)).toHaveCount(0);
    await expect(summary.getByText(/score|điểm|phần trăm/i)).toHaveCount(0);

    // The monthly calendar remains the primary section.
    await expect(page.getByRole("heading", { name: /Hoạt động tháng này/ })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("dashboard keeps the calendar below the compact summary on mobile", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await signUpAndConfirm(page, uniqueEmail("summary_hier"));
    await createSetWithCard(page, "Bộ thứ bậc");

    await page.goto("/dashboard");

    const summary = page.getByRole("region", { name: "Tóm tắt trạng thái học" });
    const calendarHeading = page.getByRole("heading", { name: /Hoạt động tháng này/ });
    await expect(summary).toBeVisible();
    await expect(calendarHeading).toBeVisible();

    const summaryBox = await summary.boundingBox();
    const calendarBox = await calendarHeading.boundingBox();
    expect(summaryBox).not.toBeNull();
    expect(calendarBox).not.toBeNull();
    expect((summaryBox?.y ?? 0) + (summaryBox?.height ?? 0)).toBeLessThanOrEqual(
      (calendarBox?.y ?? 0) + 2,
    );

    await expectNoHorizontalOverflow(page);
  });

  test("dashboard renders the recorded-activity insight between learning status and monthly activity", async ({
    page,
  }) => {
    await page.setViewportSize(MOBILE);
    await signUpAndConfirm(page, uniqueEmail("seven_day_insight"));
    await createSetWithCard(page, "Bộ insight");

    await page.goto("/dashboard");

    const summary = page.getByRole("region", { name: "Tóm tắt trạng thái học" });
    const insight = page.getByRole("region", { name: "Thông tin 7 ngày vừa qua" });
    const title = insight.getByRole("heading", { name: "7 ngày vừa qua" });
    const calendarHeading = page.getByRole("heading", { name: "Hoạt động tháng này" });

    await expect(summary.getByText("Chưa học", { exact: true })).toBeVisible();
    await expect(title).toBeVisible();
    await expect(
      insight.getByText("7 ngày vừa qua chưa có nhiều hoạt động làm bài được ghi nhận."),
    ).toHaveCount(1);
    await expect(insight.getByRole("button")).toHaveCount(0);
    await expect(page.locator('a[href="/quiz?tab=create"]')).toBeVisible();
    await expect(calendarHeading).toBeVisible();

    const summaryBox = await summary.boundingBox();
    const insightBox = await insight.boundingBox();
    const calendarBox = await calendarHeading.boundingBox();
    expect(summaryBox).not.toBeNull();
    expect(insightBox).not.toBeNull();
    expect(calendarBox).not.toBeNull();
    expect((summaryBox?.y ?? 0) + (summaryBox?.height ?? 0)).toBeLessThanOrEqual(
      (insightBox?.y ?? 0) + 2,
    );
    expect((insightBox?.y ?? 0) + (insightBox?.height ?? 0)).toBeLessThanOrEqual(
      (calendarBox?.y ?? 0) + 2,
    );

    await expectNoHorizontalOverflow(page);
  });

  test("set detail shows full-scope counts independent of pagination", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await signUpAndConfirm(page, uniqueEmail("summary_set"));

    await page.goto("/import");
    await page.getByLabel(/CSV\/XLSX/i).setInputFiles(PAGINATION_CSV);
    await page.getByLabel("Tên bộ").fill("Bộ phân trang");
    await page.getByRole("button", { name: /Tạo bộ flashcard/i }).click();
    await expect(page).toHaveURL(/\/sets\/[0-9a-f-]+$/);

    // 21 cards imported; only 20 are rendered on page 1.
    await expect(page.getByRole("navigation", { name: "Phân trang" })).toContainText("Trang 1 / 2");
    await expect(page.getByText("Chưa học", { exact: true })).toBeVisible();
    await expect(page.getByText("21", { exact: true })).toBeVisible();
    await expect(page.getByText("20", { exact: true })).not.toBeVisible();

    await expectNoHorizontalOverflow(page);

    // The mastery legend still works (no regression to Task 3 visuals).
    await page.getByRole("button", { name: "Trạng thái học" }).click();
    await expect(page.getByText("Đang học", { exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
  });
});
