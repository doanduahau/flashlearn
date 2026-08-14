import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

import { signUpAndConfirm, uniqueEmail } from "./support/auth-helpers";

const DOCX_FIXTURE = {
  name: "minimal.docx",
  mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  buffer: readFileSync(path.join(__dirname, "..", "fixtures", "documents", "minimal.docx")),
};

test("production /sets keeps non-PDF import paths free of the PDF runtime", async ({ page }) => {
  await signUpAndConfirm(page, uniqueEmail("pdf_isolation"));

  await page.goto("/sets?create=manual");
  await expect(page.getByRole("heading", { name: /tạo bộ thủ công/i })).toBeVisible();

  await page.goto("/sets?create=import");
  await expect(page.locator('input[type="file"][accept=".xlsx,.csv,.docx,.pdf"]')).toBeVisible();

  await page.goto("/sets?create=paste");
  await page.getByRole("textbox", { name: "Dán nội dung" }).fill("front\tback");
  await page.getByRole("button", { name: /phân tích/i }).click();
  await expect(page.getByText(/nguồn/i)).toBeVisible();

  await page.goto("/sets?create=google_sheets");
  await expect(page.getByText(/google sheets/i).first()).toBeVisible();

  await page.goto("/sets?create=document");
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(DOCX_FIXTURE);
  await expect(page.getByText("khối nội dung")).toBeVisible();
});
