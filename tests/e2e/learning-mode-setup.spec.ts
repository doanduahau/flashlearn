import { expect, type Page, test } from "@playwright/test";

import { signUpAndConfirm, uniqueEmail } from "./support/auth-helpers";

const MOBILE = { width: 390, height: 844 };
const CSV = "tests/fixtures/smart-review-24-cards.csv";

async function importSet(page: Page, name: string): Promise<void> {
  await page.goto("/import");
  await page.getByLabel(/CSV\/XLSX/i).setInputFiles(CSV);
  await page.getByLabel("Tên bộ").fill(name);
  await page.getByRole("button", { name: /Tạo bộ flashcard/i }).click();
  await expect(page).toHaveURL(/\/sets\/[0-9a-f-]+$/);
}

async function createCards(page: Page, name: string, count: number): Promise<void> {
  await page.goto("/sets?create=paste");
  const rows = Array.from({ length: count }, (_, i) => `Front ${i}\tBack ${i}`).join("\n");
  await page.locator("#paste-textarea").fill(rows);
  await page.getByRole("button", { name: "Phân tích" }).click();
  await expect(page.getByRole("button", { name: /Tạo bộ flashcard/i })).toBeVisible();
  await page.getByLabel("Tên bộ").fill(name);
  await page.getByRole("button", { name: /Tạo bộ flashcard/i }).click();
  await expect(page).toHaveURL(/\/sets\/[0-9a-f-]+$/);
}

test.describe("Shared learning-mode setup", () => {
  test("Học page has two top tabs and the play area has no dead Runner route", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await signUpAndConfirm(page, uniqueEmail("ia_study"));
    await importSet(page, "Bộ IA");

    await page.goto("/study");

    const traditional = page.getByRole("link", { name: "Học truyền thống" });
    const play = page.getByRole("link", { name: "Vừa học vừa chơi" });
    await expect(traditional).toHaveAttribute("aria-current", "page");
    await expect(play).toBeVisible();

    // Traditional study has no Chưa làm / Câu sai / Ngẫu nhiên filter.
    await expect(page.getByRole("button", { name: "Chưa làm" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Câu sai" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Ngẫu nhiên" })).toHaveCount(0);

    await play.click();
    await expect(play).toHaveAttribute("aria-current", "page");
    const memoryLink = page.getByRole("link", { name: /Memory Matching/ });
    await expect(memoryLink).toHaveAttribute("href", "/memory");

    await expect(page.getByText("Flashcard Runner")).toBeVisible();
    await expect(page.getByRole("link", { name: /Flashcard Runner/ })).toHaveCount(0);

    const response = await page.goto("/runner");
    expect(response?.status()).toBe(404);
  });

  test("Kiểm tra tabs are shared between Trắc nghiệm and Match", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await signUpAndConfirm(page, uniqueEmail("ia_quiz_match"));
    await importSet(page, "Bộ IA quiz");

    await page.goto("/quiz");
    await expect(page.getByRole("link", { name: "Trắc nghiệm" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(page.getByRole("link", { name: "Match" })).toBeVisible();

    await page.getByRole("link", { name: "Match" }).click();
    await expect(page).toHaveURL(/\/match$/);
    await expect(page.getByRole("link", { name: "Match" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("link", { name: "Trắc nghiệm" })).not.toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("shared mode filter is exactly Chưa làm / Câu sai / Ngẫu nhiên", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await signUpAndConfirm(page, uniqueEmail("ia_filter"));
    await importSet(page, "Bộ IA filter");

    for (const route of ["/quiz", "/match", "/memory"]) {
      await page.goto(route);
      await expect(page.getByRole("button", { name: "Chưa làm" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Câu sai" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Ngẫu nhiên" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Cân bằng" })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Chưa", exact: true })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Sai", exact: true })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Chưa kiểm tra" })).toHaveCount(0);
    }
  });

  test("quiz offers fixed counts below N plus Tất cả N", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await signUpAndConfirm(page, uniqueEmail("ia_counts"));
    await importSet(page, "Bộ IA counts"); // 24 cards

    await page.goto("/quiz");
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

  test("match with 7 eligible cards has no count and disables Start", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await signUpAndConfirm(page, uniqueEmail("ia_match7"));
    await createCards(page, "Bộ 7 thẻ", 7);

    await page.goto("/match");
    await expect(page.getByText("Không đủ thẻ chưa làm để bắt đầu.")).toBeVisible();
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

  test("Câu sai with no wrong history shows the insufficient message", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await signUpAndConfirm(page, uniqueEmail("ia_wrong"));
    await importSet(page, "Bộ IA wrong"); // 24 cards, no wrong answers yet

    await page.goto("/match");
    await page.getByRole("button", { name: "Câu sai" }).click();
    await expect(page.getByText("Không đủ câu sai để bắt đầu.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Bắt đầu Match" })).toBeDisabled();
  });

  test("controls appear before the source list, which stays the last content section", async ({
    page,
  }) => {
    await page.setViewportSize(MOBILE);
    await signUpAndConfirm(page, uniqueEmail("ia_order"));
    await importSet(page, "Bộ IA order");

    await page.goto("/quiz");

    const mode = await page.getByText("Chế độ").first().boundingBox();
    const count = await page.getByText("Số câu").first().boundingBox();
    const source = await page
      .getByRole("heading", { name: "Chọn một hoặc nhiều nguồn" })
      .boundingBox();
    const allCard = await page.getByRole("radio", { name: /Tất cả \d+ thẻ/ }).boundingBox();

    expect(mode).not.toBeNull();
    expect(count).not.toBeNull();
    expect(source).not.toBeNull();
    expect(allCard).not.toBeNull();
    expect(mode?.y ?? 0).toBeLessThan(count?.y ?? 0);
    expect(count?.y ?? 0).toBeLessThan(source?.y ?? 0);
    expect(source?.y ?? 0).toBeLessThan(allCard?.y ?? 0);
  });

  test("All renders as the first source card with the exact 'Tất cả N thẻ' copy", async ({
    page,
  }) => {
    await page.setViewportSize(MOBILE);
    await signUpAndConfirm(page, uniqueEmail("ia_all"));
    await importSet(page, "Bộ IA all");

    for (const route of ["/quiz", "/match", "/memory", "/study"]) {
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

    for (const route of ["/quiz", "/match", "/memory"]) {
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
    await expect(page.getByLabel("Nguồn đã chọn")).toContainText("Bộ IA A");
    await expect(page.getByLabel("Nguồn đã chọn")).toContainText("Bộ IA B");
  });
});
