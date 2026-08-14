import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

import { signUpAndConfirm, uniqueEmail } from "./support/auth-helpers";

const FIXTURES = path.join(__dirname, "..", "fixtures", "documents");

function fixture(name: string, mimeType: string) {
  return {
    name,
    mimeType,
    buffer: readFileSync(path.join(FIXTURES, name)),
  };
}

const DOCX_FIXTURE = fixture(
  "minimal.docx",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
);
const PDF_FIXTURE = fixture("minimal.pdf", "application/pdf");
const SCAN_ONLY_PDF = fixture("scan-only.pdf", "application/pdf");

async function openDocumentImport(page: import("@playwright/test").Page) {
  await page.goto("/sets/create?source=file");
  const fileInput = page.locator('input[type="file"]');
  await expect(fileInput).toBeVisible();
  return fileInput;
}

test.describe("Document import", () => {
  test("extracts a .docx and shows heading, paragraph, and table blocks", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await signUpAndConfirm(page, uniqueEmail("doc_docx"));

    const fileInput = await openDocumentImport(page);
    await fileInput.setInputFiles(DOCX_FIXTURE);

    await expect(page.getByText("Đang đọc tài liệu...")).toBeVisible();

    // Extraction summary metadata
    await expect(page.getByText("khối nội dung")).toBeVisible();

    // Heading block
    await expect(page.getByText("Chương 1 — Hệ điều hành")).toBeVisible();
    // Paragraph block
    await expect(page.getByText("Hệ điều hành là phần mềm quản lý tài nguyên")).toBeVisible();
    // Table block: cells from the fixture table
    await expect(page.getByRole("cell", { name: "OS là gì?" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Hệ điều hành" })).toBeVisible();

    // Order: heading appears before paragraph
    const heading = page.getByText("Chương 1 — Hệ điều hành");
    const paragraph = page.getByText("Hệ điều hành là phần mềm quản lý tài nguyên");
    const hBox = await heading.boundingBox();
    const pBox = await paragraph.boundingBox();
    expect(hBox).toBeTruthy();
    expect(pBox).toBeTruthy();
    if (hBox && pBox) expect(hBox.y).toBeLessThan(pBox.y);

    // 3E: analysis summary appears (section-level classification)
    await expect(page.getByText(/mục/)).toBeVisible();
  });

  test("extracts a text-based PDF with page-aware metadata", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await signUpAndConfirm(page, uniqueEmail("doc_pdf"));

    const fileInput = await openDocumentImport(page);
    await fileInput.setInputFiles(PDF_FIXTURE);

    await expect(page.getByText("Đang đọc tài liệu...")).toBeVisible();

    // Page-aware metadata
    await expect(page.getByText("1 trang")).toBeVisible();
    await expect(page.getByText("khối nội dung")).toBeVisible();

    // Extracted text
    await expect(page.getByText(/He dieu hanh la phan mem quan ly tai nguyen/i)).toBeVisible();
    // Page number tag
    await expect(page.getByText("trang 1")).toBeVisible();

    // 3E: analysis summary appears
    await expect(page.getByText(/mục/)).toBeVisible();
  });

  test("generates cards from a PDF and shows the quick-create summary", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await signUpAndConfirm(page, uniqueEmail("doc_pdf_unicode"));

    const fileInput = await openDocumentImport(page);
    await fileInput.setInputFiles(PDF_FIXTURE);
    await expect(page.getByText("khối nội dung")).toBeVisible();

    await page.getByRole("button", { name: "Tạo thẻ" }).click();

    // No review editor: the quick-create summary appears with valid card count.
    await expect(page.getByText(/thẻ hợp lệ/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /Tạo bộ flashcard/i })).toBeVisible();
  });

  test("rejects a scan-only PDF with a clear unsupported message", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await signUpAndConfirm(page, uniqueEmail("doc_scanonly"));

    const fileInput = await openDocumentImport(page);
    await fileInput.setInputFiles(SCAN_ONLY_PDF);

    const alert = page.getByRole("alert").filter({ hasText: "chưa hỗ trợ PDF scan/ảnh" });
    await expect(alert).toContainText(
      "PDF này không có văn bản có thể đọc. CapyStudy hiện chưa hỗ trợ PDF scan/ảnh.",
    );

    // No flashcard set is created: still on the create page with the document source open
    await expect(page).toHaveURL(/\/sets\/create\?source=file$/);
  });

  test("rejects unsupported legacy .doc format", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await signUpAndConfirm(page, uniqueEmail("doc_legacy"));

    const fileInput = await openDocumentImport(page);
    await fileInput.setInputFiles({
      name: "legacy.doc",
      mimeType: "application/msword",
      buffer: Buffer.from("not a real doc"),
    });

    const alert = page.getByRole("alert").filter({ hasText: ".docx" });
    await expect(alert).toContainText(".docx");
  });

  test("document import screen has no horizontal overflow on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signUpAndConfirm(page, uniqueEmail("doc_mobile"));

    await openDocumentImport(page);

    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasOverflow).toBe(false);

    // After extraction, preview must also stay within viewport width
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(DOCX_FIXTURE);
    await expect(page.getByText("khối nội dung")).toBeVisible();
    const overflowAfter = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflowAfter).toBe(false);
  });
});
