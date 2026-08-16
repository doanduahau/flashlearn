import { expect, type Page, test } from "@playwright/test";

import { signUpAndConfirm, uniqueEmail } from "./support/auth-helpers";

const MOBILE = { width: 390, height: 844 };
const CSV = "tests/fixtures/smart-review-24-cards.csv";

async function importSet(page: Page, name: string): Promise<void> {
  await page.goto("/sets/create?source=file");
  await page.getByLabel(/CSV\/XLSX/i).setInputFiles(CSV);
  await page.getByRole("button", { name: "Phân tích" }).click();
  await page.getByLabel("Tên bộ").fill(name);
  await page.getByRole("button", { name: /Tạo bộ flashcard/i }).click();
  await expect(page).toHaveURL(/\/sets\/[0-9a-f-]+$/);
}

async function createCards(page: Page, name: string, count: number): Promise<void> {
  await page.goto("/sets/create");
  const rows = Array.from({ length: count }, (_, i) => `Front ${i}\tBack ${i}`).join("\n");
  await page.locator("#paste-textarea").fill(rows);
  await page.getByRole("button", { name: "Phân tích" }).click();
  await expect(page.getByRole("button", { name: /Tạo bộ flashcard/i })).toBeVisible();
  await page.getByLabel("Tên bộ").fill(name);
  await page.getByRole("button", { name: /Tạo bộ flashcard/i }).click();
  await expect(page).toHaveURL(/\/sets\/[0-9a-f-]+$/);
}

test.describe("Shared learning-mode setup", () => {
  test("Học page has no tabs and the mode cards live behind Bắt đầu học", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await signUpAndConfirm(page, uniqueEmail("ia_study"));
    await importSet(page, "Bộ IA");

    await page.goto("/study");

    // No traditional/play tabs remain on /study.
    await expect(page.getByRole("link", { name: "Học truyền thống" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Vừa học vừa chơi" })).toHaveCount(0);

    // No Chưa làm / Câu sai / Ngẫu nhiên filter on /study.
    await expect(page.getByRole("button", { name: "Chưa làm" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Câu sai" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Ngẫu nhiên" })).toHaveCount(0);

    // Bắt đầu học leads to the three mode cards.
    await page.getByRole("button", { name: /Bắt đầu học/ }).click();
    await expect(page).toHaveURL(/\/study\/mode\?all=1$/);
    await expect(page.getByRole("heading", { name: "Lật thẻ" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Memory matching" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Capy runner" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Memory Matching" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Capy Runner/ })).toHaveCount(0);

    // All three mode cards fit on one mobile screen without scrolling.
    const runnerHeading = page.getByRole("heading", { name: "Capy runner" });
    await expect(runnerHeading).toBeInViewport({ ratio: 0.5 });
    const scroll = await page.evaluate(() => ({
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scroll.scrollHeight).toBeLessThanOrEqual(scroll.clientHeight);
    expect(scroll.scrollWidth).toBeLessThanOrEqual(scroll.clientWidth);
  });

  test("Memory and Runner mode cards are disabled below 12 cards with a clear notice", async ({
    page,
  }) => {
    await page.setViewportSize(MOBILE);
    await signUpAndConfirm(page, uniqueEmail("ia_mode_min"));
    await createCards(page, "Bộ ít thẻ", 7);

    await page.goto("/study");
    await page.getByRole("button", { name: /Bắt đầu học/ }).click();
    await expect(page).toHaveURL(/\/study\/mode/);
    await expect(page.getByRole("button", { name: "Bắt đầu lật thẻ" })).toBeEnabled();
    await expect(page.getByText("Cần tối thiểu 12 thẻ — phạm vi hiện có 7 thẻ")).toHaveCount(2);
  });

  test("no mode exposes a mode filter (Chưa làm / Câu sai / Ngẫu nhiên)", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await signUpAndConfirm(page, uniqueEmail("ia_filter"));
    await importSet(page, "Bộ IA filter");

    for (const route of ["/quiz", "/match", "/memory", "/runner"]) {
      await page.goto(route);
      await expect(page.getByRole("button", { name: "Chưa làm" })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Câu sai" })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Ngẫu nhiên" })).toHaveCount(0);
    }
  });

  test("quiz offers fixed counts below N plus Tất cả N", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await signUpAndConfirm(page, uniqueEmail("ia_counts"));
    await importSet(page, "Bộ IA counts"); // 24 cards

    await page.goto("/quiz");
    await page.getByRole("button", { name: "Bắt đầu kiểm tra" }).click();
    await page.getByLabel("Bắt đầu Trắc nghiệm").click();
    // Fresh user, Chưa làm: N = 24 -> [10][20][Tất cả 24]; 30/50 hidden.
    await expect(page.getByRole("button", { name: "10" })).toBeVisible();
    await expect(page.getByRole("button", { name: "20" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Tất cả 24" })).toBeVisible();
    await expect(page.getByRole("button", { name: "30" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "50" })).toHaveCount(0);
  });

  test("match and memory use only 12/18/24 and never show Tất cả N", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await signUpAndConfirm(page, uniqueEmail("ia_practice_counts"));
    await importSet(page, "Bộ IA practice"); // 24 cards

    for (const route of ["/match", "/memory"]) {
      await page.goto(route);
      for (const count of ["12 câu", "18 câu", "24 câu"]) {
        await expect(page.getByRole("button", { name: count })).toBeVisible();
      }
      await expect(page.getByRole("button", { name: /Tất cả \d+/ })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "50" })).toHaveCount(0);
    }
  });

  test("quiz with 7 cards disables Trắc nghiệm", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await signUpAndConfirm(page, uniqueEmail("ia_quiz7"));
    await createCards(page, "Bộ 7 quiz", 7);

    await page.goto("/quiz");
    await page.getByRole("button", { name: "Bắt đầu kiểm tra" }).click();
    await expect(page.getByRole("button", { name: "Bắt đầu Trắc nghiệm" })).toHaveCount(0);
    await expect(page.getByText(/Cần tối thiểu 10 thẻ/).first()).toBeVisible();
  });

  test("match with 7 eligible cards has no count and disables Start", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await signUpAndConfirm(page, uniqueEmail("ia_match7"));
    await createCards(page, "Bộ 7 thẻ", 7);

    await page.goto("/match");
    await expect(page.getByText("Match yêu cầu ít nhất 12 thẻ có thể ghép rõ ràng.")).toBeVisible();
    await expect(page.getByRole("button", { name: "12 câu" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Bắt đầu Match" })).toBeDisabled();
  });

  test("match with 13 eligible cards offers only 12", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await signUpAndConfirm(page, uniqueEmail("ia_match13"));
    await createCards(page, "Bộ 13 thẻ", 13);

    await page.goto("/match");
    await expect(page.getByRole("button", { name: "12 câu" })).toBeVisible();
    await expect(page.getByRole("button", { name: "18 câu" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "24 câu" })).toHaveCount(0);
  });

  test("memory with 19 eligible cards offers 12 and 18", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await signUpAndConfirm(page, uniqueEmail("ia_mem19"));
    await createCards(page, "Bộ 19 thẻ", 19);

    await page.goto("/memory");
    await expect(page.getByRole("button", { name: "12 câu" })).toBeVisible();
    await expect(page.getByRole("button", { name: "18 câu" })).toBeVisible();
    await expect(page.getByRole("button", { name: "24 câu" })).toHaveCount(0);
  });

  test("source list is rendered below the main heading on setup pages", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await signUpAndConfirm(page, uniqueEmail("ia_order"));
    await importSet(page, "Bộ IA order");

    await page.goto("/quiz");

    const source = await page
      .getByRole("heading", { name: "Chọn một hoặc nhiều nguồn" })
      .boundingBox();
    const allCard = await page.getByRole("radio", { name: /Tất cả \d+ thẻ/ }).boundingBox();

    expect(source).not.toBeNull();
    expect(allCard).not.toBeNull();
    expect(source?.y ?? 0).toBeLessThan(allCard?.y ?? 0);
  });

  test("All renders as the first source card with the exact 'Tất cả N thẻ' copy", async ({
    page,
  }) => {
    await page.setViewportSize(MOBILE);
    await signUpAndConfirm(page, uniqueEmail("ia_all"));
    await importSet(page, "Bộ IA all");

    for (const route of ["/quiz", "/match", "/memory", "/runner", "/study"]) {
      await page.goto(route);
      const allCard = page.getByRole("radio", { name: /^Tất cả \d+ thẻ$/ });
      await expect(allCard).toBeVisible();
      const list = page.getByRole("list");
      await expect(list.locator("li").first()).toContainText(/^Tất cả \d+ thẻ/);
    }
  });

  test("search and source-card selection are shared across modes", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await signUpAndConfirm(page, uniqueEmail("ia_search"));
    await importSet(page, "Bộ IA search");

    for (const route of ["/quiz", "/match", "/memory", "/runner"]) {
      await page.goto(route);
      await expect(page.getByLabel("Tìm nguồn theo tên")).toBeVisible();
      await expect(page.getByRole("checkbox", { name: /Bộ IA search, Bộ thường/ })).toBeVisible();
    }
  });

  test("regular-set multi-select is allowed within the same area", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await signUpAndConfirm(page, uniqueEmail("ia_area"));
    await importSet(page, "Bộ IA A");
    await importSet(page, "Bộ IA B");

    await page.goto("/match");
    await page.getByRole("checkbox", { name: /Bộ IA A, Bộ thường/ }).check();
    await page.getByRole("checkbox", { name: /Bộ IA B, Bộ thường/ }).check();
    await expect(page.getByRole("checkbox", { name: /Bộ IA A, Bộ thường/ })).toBeChecked();
    await expect(page.getByRole("checkbox", { name: /Bộ IA B, Bộ thường/ })).toBeChecked();
  });
});
