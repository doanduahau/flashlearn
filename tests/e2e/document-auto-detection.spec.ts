import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

import { signUpAndConfirm, uniqueEmail } from "./support/auth-helpers";

const FIXTURES = path.join(__dirname, "..", "fixtures", "documents");

function fixture(name: string) {
  return {
    name,
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    buffer: readFileSync(path.join(FIXTURES, name)),
  };
}

const STRUCTURED_DOCX = fixture("structured.docx");
const PROSE_DOCX = fixture("prose.docx");
const AMBIGUOUS_DOCX = fixture("ambiguous.docx");
const MIXED_DOCX = fixture("mixed.docx");

async function openDocumentImport(page: import("@playwright/test").Page) {
  await page.goto("/sets");
  await page.getByRole("link", { name: /tài liệu/i }).click();
  const fileInput = page.locator('input[type="file"]');
  await expect(fileInput).toBeVisible();
  return fileInput;
}

async function classifierCalls(page: import("@playwright/test").Page): Promise<number> {
  const res = await page.request.get("/api/test/classifier-count");
  const body = (await res.json()) as { calls?: number };
  return body.calls ?? 0;
}
test.describe("Document auto-detection (3E)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }) => {
    await page.request.get("/api/test/classifier-count?reset=1");
  });

  test("classifies a structured Q/A document deterministically with zero AI calls", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await signUpAndConfirm(page, uniqueEmail("detect_structured"));

    const before = await classifierCalls(page);

    const fileInput = await openDocumentImport(page);
    await fileInput.setInputFiles(STRUCTURED_DOCX);

    // Analysis summary appears with a flashcard-like ("mục thẻ") badge.
    await expect(page.getByText("mục thẻ")).toBeVisible();

    // Deterministic classification: zero additional classifier (Gemini) calls.
    const after = await classifierCalls(page);
    expect(after - before).toBe(0);
  });

  test("classifies a clear prose document deterministically with zero AI calls", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await signUpAndConfirm(page, uniqueEmail("detect_prose"));

    const before = await classifierCalls(page);

    const fileInput = await openDocumentImport(page);
    await fileInput.setInputFiles(PROSE_DOCX);

    await expect(page.getByText("mục văn bản")).toBeVisible();

    // Prose is obvious -> deterministic -> zero additional AI calls.
    const after = await classifierCalls(page);
    expect(after - before).toBe(0);
  });

  test("uses the classifier fallback exactly once for an ambiguous document", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await signUpAndConfirm(page, uniqueEmail("detect_ambiguous"));

    const before = await classifierCalls(page);

    const fileInput = await openDocumentImport(page);
    await fileInput.setInputFiles(AMBIGUOUS_DOCX);

    // Ambiguous content (small headerless 2-col table + prose) falls below the
    // deterministic threshold and uses the mocked classifier.
    await expect(page.getByText(/mục/)).toBeVisible();

    // Exactly one additional classifier call.
    const after = await classifierCalls(page);
    expect(after - before).toBe(1);

    // No flashcards generated: no set creation UI/redirect occurs.
    await expect(page).toHaveURL(/\/sets\?create=document$/);
  });

  test("classifies a mixed document at section level, not a single global type", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await signUpAndConfirm(page, uniqueEmail("detect_mixed"));

    const before = await classifierCalls(page);

    const fileInput = await openDocumentImport(page);
    await fileInput.setInputFiles(MIXED_DOCX);

    // Section 1 (prose heading + paragraph) -> prose badge.
    await expect(page.getByText("mục văn bản")).toBeVisible();
    // Section 2 (Q/A table) -> flashcard-like badge.
    await expect(page.getByText("mục thẻ")).toBeVisible();

    // Both badges present => not forced into one global type.
    // Structured + prose sections are deterministic -> zero additional AI calls.
    const after = await classifierCalls(page);
    expect(after - before).toBe(0);
  });
});

async function generationCalls(page: import("@playwright/test").Page): Promise<number> {
  const res = await page.request.get("/api/test/generation-count");
  const body = (await res.json()) as { calls?: number };
  return body.calls ?? 0;
}

test.describe("Document generation (3F)", () => {
  test.describe.configure({ mode: "serial" });

  test("generates deterministic cards from a structured DOCX with zero AI generation", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await signUpAndConfirm(page, uniqueEmail("gen_structured"));

    const genBefore = await generationCalls(page);

    const fileInput = await openDocumentImport(page);
    await fileInput.setInputFiles(STRUCTURED_DOCX);

    // Wait for analysis to complete
    await expect(page.getByText("mục thẻ")).toBeVisible();

    // Click Tạo thẻ
    await page.getByRole("button", { name: "Tạo thẻ" }).click();

    // Generation result visible — unified editor appears
    await expect(page.getByRole("button", { name: /thêm thẻ/i })).toBeVisible();

    // Zero generation AI calls (structured = deterministic)
    const genAfter = await generationCalls(page);
    expect(genAfter - genBefore).toBe(0);
  });

  test("generates cards from a prose DOCX using the mocked generation provider", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await signUpAndConfirm(page, uniqueEmail("gen_prose"));

    const genBefore = await generationCalls(page);

    const fileInput = await openDocumentImport(page);
    await fileInput.setInputFiles(PROSE_DOCX);

    await expect(page.getByText("mục văn bản")).toBeVisible();

    await page.getByRole("button", { name: "Tạo thẻ" }).click();

    await expect(page.getByRole("button", { name: /thêm thẻ/i })).toBeVisible();

    // Prose = mocked AI generation = exactly 1 call
    const genAfter = await generationCalls(page);
    expect(genAfter - genBefore).toBe(1);
  });

  test("generates cards from a mixed document with hybrid processing", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await signUpAndConfirm(page, uniqueEmail("gen_mixed"));

    const genBefore = await generationCalls(page);

    const fileInput = await openDocumentImport(page);
    await fileInput.setInputFiles(MIXED_DOCX);

    // Mixed doc shows both badges
    await expect(page.getByText("mục văn bản")).toBeVisible();
    await expect(page.getByText("mục thẻ")).toBeVisible();

    await page.getByRole("button", { name: "Tạo thẻ" }).click();

    await expect(page.getByRole("button", { name: /thêm thẻ/i })).toBeVisible();

    // Mixed = deterministic table + AI for prose = 1 gen call
    const genAfter = await generationCalls(page);
    expect(genAfter - genBefore).toBe(1);
  });

  test("reports a recoverable generation error when AI generation fails", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await signUpAndConfirm(page, uniqueEmail("gen_failure"));

    // Enable the mock generation failure flag.
    await page.request.get("/api/test/generation-count?fail=1");

    try {
      const fileInput = await openDocumentImport(page);
      await fileInput.setInputFiles(MIXED_DOCX);

      // Mixed doc analysis completes.
      await expect(page.getByText("mục văn bản")).toBeVisible();

      // Trigger generation; AI fails but deterministic table cards survive.
      await page.getByRole("button", { name: "Tạo thẻ" }).click();

      // Deterministic cards are still shown (table cards survive).
      await expect(page.getByRole("button", { name: /thêm thẻ/i })).toBeVisible();
      // A clear warning is visible.
      await expect(page.getByText(/AI không khả dụng|Không thể tạo thẻ/)).toBeVisible();

      // No flashcard set is created (no navigation to /sets/[id]).
      await expect(page).toHaveURL(/\/sets\?create=document$/);
    } finally {
      await page.request.get("/api/test/generation-count?fail=0");
    }
  });
});
