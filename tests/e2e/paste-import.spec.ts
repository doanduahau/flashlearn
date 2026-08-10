import { expect, test } from "@playwright/test";

import { signUpAndConfirm, uniqueEmail } from "./support/auth-helpers";

test.describe("Paste import", () => {
  test("imports TSV structured paste and creates a set", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signUpAndConfirm(page, uniqueEmail("paste_tsv"));

    await page.goto("/sets");
    await page.getByRole("link", { name: /dán nội dung/i }).click();

    const textarea = page.locator("#paste-textarea");
    await textarea.fill("apple\tquả táo\nbanana\tquả chuối\norange\tquả cam");

    await page.getByRole("button", { name: "Phân tích" }).click();

    await expect(page.getByText("3 thẻ hợp lệ")).toBeVisible();
    const table = page.locator("table");
    await expect(table.getByRole("cell", { name: "apple" })).toBeVisible();
    await expect(table.getByRole("cell", { name: "quả táo" })).toBeVisible();
    await expect(table.getByRole("cell", { name: "banana" })).toBeVisible();
    await expect(table.getByRole("cell", { name: "quả chuối" })).toBeVisible();

    await page.locator("#paste-set-name").fill("Bộ từ paste TSV");
    await page.getByRole("button", { name: /tạo bộ/i }).click();

    await expect(page).toHaveURL(/\/sets\/[0-9a-f-]+$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bộ từ paste TSV");
    await expect(page.getByText(/3 flashcard/)).toBeVisible();
  });

  test("shows error for empty paste", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signUpAndConfirm(page, uniqueEmail("paste_empty"));

    await page.goto("/sets");
    await page.getByRole("link", { name: /dán nội dung/i }).click();

    await page.getByRole("button", { name: "Phân tích" }).click();

    const alert = page.getByRole("alert").filter({ hasText: "Vui lòng" });
    await expect(alert).toBeVisible();
    await expect(alert).toContainText("Vui lòng dán nội dung");
  });

  test("imports Q:/A: structured paste", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signUpAndConfirm(page, uniqueEmail("paste_qa"));

    await page.goto("/sets");
    await page.getByRole("link", { name: /dán nội dung/i }).click();

    const textarea = page.locator("#paste-textarea");
    await textarea.fill(
      "Q: HTTP là gì?\nA: Giao thức truyền tải siêu văn bản\nQ: DNS là gì?\nA: Hệ thống phân giải tên miền",
    );

    await page.getByRole("button", { name: "Phân tích" }).click();

    await expect(page.getByText("2 thẻ hợp lệ")).toBeVisible();
    const table = page.locator("table");
    await expect(table.getByRole("cell", { name: "HTTP là gì?" })).toBeVisible();
    await expect(
      table.getByRole("cell", { name: "Giao thức truyền tải siêu văn bản" }),
    ).toBeVisible();

    await page.locator("#paste-set-name").fill("Bộ từ paste Q/A");
    await page.getByRole("button", { name: /tạo bộ/i }).click();

    await expect(page).toHaveURL(/\/sets\/[0-9a-f-]+$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bộ từ paste Q/A");
    await expect(page.getByText(/2 flashcard/)).toBeVisible();
  });

  test("mobile paste has no horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signUpAndConfirm(page, uniqueEmail("paste_mobile"));

    await page.goto("/sets");
    await page.getByRole("link", { name: /dán nội dung/i }).click();

    const textarea = page.locator("#paste-textarea");
    await expect(textarea).toBeVisible();

    const box = await textarea.boundingBox();
    expect(box).toBeTruthy();
    if (box) {
      expect(box.x + box.width).toBeLessThanOrEqual(390);
    }

    await textarea.fill(
      "Q: Một câu hỏi dài để kiểm tra tràn màn hình?\nA: Một câu trả lời cũng khá dài để đảm bảo không bị tràn.",
    );
    await page.getByRole("button", { name: "Phân tích" }).click();
    await expect(page.getByText("1 thẻ hợp lệ")).toBeVisible();

    const previewTable = page.locator("table").first();
    const previewBox = await previewTable.boundingBox();
    if (previewBox) {
      expect(previewBox.x + previewBox.width).toBeLessThanOrEqual(390);
    }
  });

  test("excel import still works alongside paste", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signUpAndConfirm(page, uniqueEmail("paste_excel"));

    await page.goto("/sets");

    await expect(page.getByRole("link", { name: /nhập excel/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /dán nội dung/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /thủ công/i })).toBeVisible();

    await page.getByRole("link", { name: /dán nội dung/i }).click();
    const pasteTextarea = page.locator("#paste-textarea");
    await expect(pasteTextarea).toBeVisible();

    await page.getByRole("link", { name: /đóng/i }).click();
    await expect(pasteTextarea).not.toBeVisible();

    await page.getByRole("link", { name: /nhập excel/i }).click();
    await expect(page.locator("input[type=file]")).toBeVisible();
  });
});
