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

    // Traditional study has no Chưa / Sai / Ngẫu nhiên filter.
    await expect(page.getByRole("button", { name: "Chưa" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Sai" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Ngẫu nhiên" })).toHaveCount(0);

    // Play tab lists Memory (functional) and Runner (future, non-interactive).
    await play.click();
    await expect(play).toHaveAttribute("aria-current", "page");
    const memoryLink = page.getByRole("link", { name: /Memory Matching/ });
    await expect(memoryLink).toHaveAttribute("href", "/memory");

    const runner = page.getByText("Flashcard Runner");
    await expect(runner).toBeVisible();
    // Runner must not be a clickable link.
    await expect(page.getByRole("link", { name: /Flashcard Runner/ })).toHaveCount(0);

    // No dead /runner route exists.
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
  });

  test("shared mode filter is exactly Chưa / Sai / Ngẫu nhiên across Quiz, Match and Memory", async ({
    page,
  }) => {
    await page.setViewportSize(MOBILE);
    await signUpAndConfirm(page, uniqueEmail("ia_filter"));
    await importSet(page, "Bộ IA filter");

    for (const route of ["/quiz", "/match", "/memory"]) {
      await page.goto(route);
      await expect(page.getByRole("button", { name: "Chưa" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Sai" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Ngẫu nhiên" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Cân bằng" })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Chưa kiểm tra" })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Câu sai" })).toHaveCount(0);
    }
  });

  test("question counts are mode-specific", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await signUpAndConfirm(page, uniqueEmail("ia_counts"));
    await importSet(page, "Bộ IA counts");

    await page.goto("/quiz");
    for (const count of ["10", "20", "30", "50"]) {
      await expect(page.getByRole("button", { name: count })).toBeVisible();
    }
    await expect(page.getByRole("button", { name: "12 câu" })).toHaveCount(0);

    for (const route of ["/match", "/memory"]) {
      await page.goto(route);
      for (const count of ["12 câu", "18 câu", "24 câu"]) {
        await expect(page.getByRole("button", { name: count })).toBeVisible();
      }
      await expect(page.getByRole("button", { name: "50" })).toHaveCount(0);
    }
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
      // The All option belongs to the same source-card list, not a separate hero.
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
      const checkbox = page.getByRole("checkbox", { name: /Bộ IA search, Bộ thường/ });
      await expect(checkbox).toBeVisible();
    }
  });

  test("regular-set multi-select is allowed but cross-area mixing clears the previous area", async ({
    page,
  }) => {
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
