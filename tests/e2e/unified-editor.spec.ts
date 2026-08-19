import { expect, test } from "@playwright/test";
import path from "node:path";

import { signUpAndConfirm, uniqueEmail } from "./support/auth-helpers";
import { supabaseRest } from "./support/supabase-api";

const IMPORT_CSV = path.join(__dirname, "..", "fixtures", "set-management.csv");
const COLUMN_MAPPING_CSV = path.join(__dirname, "..", "fixtures", "column-mapping.csv");

test.describe("Quick-create import (3G)", () => {
  test("Excel: file selection leads to the quick-create summary and creates the set", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await signUpAndConfirm(page, uniqueEmail("editor_excel_persist"));

    await page.goto("/sets/create?source=file");

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(IMPORT_CSV);
    await page.getByRole("button", { name: "Phân tích" }).click();

    // No review editor: the quick-create summary appears after parsing.
    await expect(page.getByRole("button", { name: /Tạo bộ flashcard/i })).toBeVisible({
      timeout: 10000,
    });

    // Fill set name and import
    await page.getByLabel("Tên bộ").fill("Bộ đã sửa thẻ");
    await page.getByRole("button", { name: /Tạo bộ flashcard/i }).click();

    // Navigate to the created set
    await expect(page).toHaveURL(/\/sets\/[0-9a-f-]+$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bộ đã sửa thẻ");
  });

  test("Excel: picking a non-header column for front/back updates the card count", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await signUpAndConfirm(page, uniqueEmail("editor_colmap"));

    await page.goto("/sets/create?source=file");

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(COLUMN_MAPPING_CSV);
    await page.getByRole("button", { name: "Phân tích" }).click();

    await expect(page.getByRole("button", { name: /Tạo bộ flashcard/i })).toBeVisible({
      timeout: 10000,
    });

    // Default mapping (front=0, back=1) yields 3 valid cards.
    await expect(page.getByText("3 thẻ hợp lệ")).toBeVisible();

    // Column 2 (index 1) uses its first populated value as the display label.
    await expect(page.getByLabel("Mặt trước")).toContainText("One");

    // Pick column 3 (index 2) as front and column 2 (index 1) as back.
    await page.getByLabel("Mặt trước").selectOption("2");
    await page.getByLabel("Mặt sau").selectOption("1");

    // The third data row has an empty front cell under this mapping → 2 valid cards.
    await expect(page.getByText("2 thẻ hợp lệ")).toBeVisible();
  });

  test("Paste: summary appears after analysis and creates a set, zero Gemini", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await signUpAndConfirm(page, uniqueEmail("editor_paste"));

    await page.goto("/sets/create");

    const textarea = page.locator("#paste-textarea");
    await textarea.fill("apple\tquả táo\nbanana\tquả chuối");

    await page.getByRole("button", { name: "Phân tích" }).click();

    // Summary appears after analysis
    await expect(page.getByRole("button", { name: /Tạo bộ flashcard/i })).toBeVisible();
    await expect(page.getByText("2 thẻ hợp lệ")).toBeVisible();

    // Import
    await page.getByLabel("Tên bộ").fill("Bộ từ paste đã sửa");
    await page.getByRole("button", { name: /Tạo bộ flashcard/i }).click();

    await expect(page).toHaveURL(/\/sets\/[0-9a-f-]+$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bộ từ paste đã sửa");
  });

  test("mobile paste import: no horizontal overflow, actions reachable", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signUpAndConfirm(page, uniqueEmail("editor_mobile"));

    await page.goto("/sets/create");

    const textarea = page.locator("#paste-textarea");
    await textarea.fill("a\tb\nc\td");
    await page.getByRole("button", { name: "Phân tích" }).click();

    await expect(page.getByRole("button", { name: /Tạo bộ flashcard/i })).toBeVisible();

    // No horizontal overflow
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);

    // Summary actions reachable
    await expect(page.getByText("2 thẻ hợp lệ")).toBeVisible();
    await expect(page.getByLabel("Tên bộ")).toBeVisible();
    await expect(page.getByRole("button", { name: /Tạo bộ flashcard/i })).toBeVisible();

    // Fill set name and import (proves import works on mobile)
    await page.getByLabel("Tên bộ").fill("Bộ mobile");
    await page.getByRole("button", { name: /Tạo bộ flashcard/i }).click();
    await expect(page).toHaveURL(/\/sets\/[0-9a-f-]+$/);
  });

  test("create is blocked until a set name is provided", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await signUpAndConfirm(page, uniqueEmail("editor_limit"));

    await page.goto("/sets/create");

    const textarea = page.locator("#paste-textarea");
    await textarea.fill("x\ty");

    await page.getByRole("button", { name: "Phân tích" }).click();
    await expect(page.getByRole("button", { name: /Tạo bộ flashcard/i })).toBeVisible();

    // Without a set name the create button stays disabled.
    await expect(page.getByRole("button", { name: /Tạo bộ flashcard/i })).toBeDisabled();
  });

  test("persisted cards reflect the source values in the database", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await signUpAndConfirm(page, uniqueEmail("editor_persist"));

    await page.goto("/sets/create");

    // Source: A → 1, B → 2
    const textarea = page.locator("#paste-textarea");
    await textarea.fill("A\t1\nB\t2");
    await page.getByRole("button", { name: "Phân tích" }).click();

    await expect(page.getByRole("button", { name: /Tạo bộ flashcard/i })).toBeVisible();

    // Import
    await page.getByLabel("Tên bộ").fill("Bộ persist đầy đủ");
    await page.getByRole("button", { name: /Tạo bộ flashcard/i }).click();
    await expect(page).toHaveURL(/\/sets\/([0-9a-f-]+)$/);

    const setId = new URL(page.url()).pathname.split("/").pop() ?? "";

    // Query the created set's cards in position order
    const response = await supabaseRest(
      page.context(),
      `flashcards?set_id=eq.${setId}&select=front,back,position&order=position.asc`,
    );
    expect(response.ok).toBe(true);
    const cards = (await response.json()) as Array<{
      front: string;
      back: string;
      position: number;
    }>;

    expect(cards.map((c) => c.front)).toEqual(["A", "B"]);
    expect(cards.map((c) => c.back)).toEqual(["1", "2"]);
  });
});
