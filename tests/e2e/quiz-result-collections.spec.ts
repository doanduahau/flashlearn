import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { expect, type Page, test } from "@playwright/test";

import { signUpAndConfirm, uniqueEmail } from "./support/auth-helpers";

const QUIZ_CSV = "tests/fixtures/quiz-cards.csv";
const SET_NAME = "Bộ kiểm tra kết quả";
const COLLECTION_NAME = "Khó nhớ";
const AUTH_STATE = "tests/e2e/.auth/quiz-result-collections.json";

test.describe("Quiz result collections", () => {
  test.describe.configure({ mode: "serial" });

  let setId = "";
  let resultUrl = "";
  let correctPrompt = "";
  let wrongPrompt = "";

  test("adds an incorrectly answered card to a special collection from the result page", async ({
    page,
  }) => {
    await signUpAndConfirm(page, uniqueEmail("quizresult_a"));

    await page.goto("/import");
    await page.getByLabel(/CSV\/XLSX/i).setInputFiles(QUIZ_CSV);
    await page.getByLabel(/^4\./).fill(SET_NAME);
    await page.getByRole("button", { name: /Xác nhận import/i }).click();

    await expect(page).toHaveURL(/\/sets\/[0-9a-f-]+$/);
    setId = new URL(page.url()).pathname.split("/").pop() ?? "";
    await expect(page.getByText(/10 flashcard/)).toBeVisible();

    await page.goto("/collections");
    await page.getByRole("button", { name: /Tạo bộ đặc biệt/ }).click();
    await page.getByLabel("Tên bộ").fill(COLLECTION_NAME);
    await page.getByRole("button", { name: /^Tạo bộ$/ }).click();
    await expect(page.getByRole("link", { name: /Khó nhớ/ })).toBeVisible();

    await page.goto("/quiz");
    await page.getByRole("button", { name: "Bắt đầu kiểm tra" }).click();
    await expect(page).toHaveURL(/\/quiz\/[0-9a-f-]+$/);

    correctPrompt = await answerQuestion(page, true);
    wrongPrompt = await answerQuestion(page, false);
    for (let index = 2; index < 10; index += 1) {
      await answerQuestion(page, false);
    }
    await expect(page).toHaveURL(/\/quiz\/[0-9a-f-]+\/result$/);
    resultUrl = page.url();

    await expect(page.getByText("1/10 đúng")).toBeVisible();
    await expect(page.getByText(/Chuỗi 1 ngày, hôm nay đã hoàn thành/)).toBeVisible();

    const correctArticle = page.locator("article").filter({ hasText: correctPrompt });
    await expect(correctArticle.getByRole("button", { name: "Thêm vào bộ đặc biệt" })).toHaveCount(
      0,
    );

    await expect(page.getByRole("button", { name: "Thêm vào bộ đặc biệt" })).toHaveCount(9);

    const wrongArticle = page.locator("article").filter({ hasText: wrongPrompt });
    await addCardToCollection(page, wrongArticle, COLLECTION_NAME);
    await expect(page).toHaveURL(resultUrl);

    mkdirSync(dirname(AUTH_STATE), { recursive: true });
    await page.context().storageState({ path: AUTH_STATE });
  });

  test("membership appears in the collection and the source card stays in its set", async ({
    browser,
  }) => {
    const context = await browser.newContext({ storageState: AUTH_STATE });
    const page = await context.newPage();

    await page.goto("/collections");
    await page.getByRole("link", { name: /Khó nhớ/ }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(COLLECTION_NAME);
    await expect(page.getByText(/1 thẻ/)).toBeVisible();
    await expect(page.getByText(wrongPrompt)).toBeVisible();

    await page.goto(`/sets/${setId}`);
    await expect(page.getByText(/10 flashcard/)).toBeVisible();
    await expect(page.getByText(wrongPrompt)).toBeVisible();

    await context.close();
  });

  test("adding the same card again does not duplicate the membership", async ({ browser }) => {
    const context = await browser.newContext({ storageState: AUTH_STATE });
    const page = await context.newPage();

    await page.goto(resultUrl);
    const article = page.locator("article").filter({ hasText: wrongPrompt });
    await article.getByRole("button", { name: "Thêm vào bộ đặc biệt" }).click();
    await expect(article.getByRole("checkbox", { name: COLLECTION_NAME })).toBeChecked();
    await article.getByRole("button", { name: /^Lưu$/i }).click();

    await page.goto("/collections");
    await page.getByRole("link", { name: /Khó nhớ/ }).click();
    await expect(page.getByText(/1 thẻ/)).toBeVisible();
    await expect(page.getByText(wrongPrompt)).toHaveCount(1);

    await context.close();
  });

  test("the add-to-collection panel fits within the mobile viewport", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: AUTH_STATE,
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();

    await page.goto(resultUrl);
    const article = page.locator("article").filter({ hasText: wrongPrompt });
    await article.getByRole("button", { name: "Thêm vào bộ đặc biệt" }).click();
    const panel = article.getByTestId("card-collections-panel");
    await expect(panel).toBeVisible();

    const box = await panel.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(390);

    await panel.getByRole("button", { name: /Hủy/i }).click();
    await expect(panel).toBeHidden();

    await context.close();
  });

  test("a deleted source card shows an explanation instead of the action", async ({ browser }) => {
    const context = await browser.newContext({ storageState: AUTH_STATE });
    const page = await context.newPage();

    await page.goto(`/sets/${setId}`);
    const row = page.locator("li").filter({ hasText: wrongPrompt }).last();
    await row.getByRole("button", { name: /Xóa thẻ/i }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /Xóa vĩnh viễn/i })
      .click();
    await expect(page.getByText(wrongPrompt)).toHaveCount(0);

    await page.goto(resultUrl);
    const article = page.locator("article").filter({ hasText: wrongPrompt });
    await expect(article.getByRole("button", { name: "Thêm vào bộ đặc biệt" })).toHaveCount(0);
    await expect(
      article.getByText("Thẻ gốc đã bị xóa nên không thể thêm vào bộ đặc biệt."),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Thêm vào bộ đặc biệt" })).toHaveCount(8);

    await context.close();
  });
});

async function answerQuestion(page: Page, wantCorrect: boolean): Promise<string> {
  await expect(page.getByRole("status")).toHaveCount(0);
  const radios = page.getByRole("radio");
  await expect(radios.first()).toBeEnabled();

  const heading = page.getByRole("heading", { level: 1 });
  const prompt = (await heading.textContent()) ?? "";
  const correctAnswer = prompt.replace("prompt", "answer");

  const labels = page.locator("fieldset label");
  const count = await labels.count();
  let selected = false;
  for (let index = 0; index < count; index += 1) {
    const text = (await labels.nth(index).textContent())?.trim() ?? "";
    const matches = text === correctAnswer;
    if (wantCorrect ? matches : !matches) {
      await labels.nth(index).getByRole("radio").check();
      selected = true;
      break;
    }
  }
  expect(selected).toBe(true);
  await page.getByRole("button", { name: "Xác nhận đáp án" }).click();
  await expect(page.getByRole("status")).toHaveText(/^(Chính xác|Chưa chính xác)\.$/);
  const nextButton = page.getByRole("button", { name: /Câu tiếp theo|Xem kết quả/ });
  if ((await nextButton.count()) > 0) {
    await nextButton.click();
  }
  return prompt;
}

async function addCardToCollection(
  page: Page,
  article: ReturnType<Page["locator"]>,
  collectionName: string,
): Promise<void> {
  await article.getByRole("button", { name: "Thêm vào bộ đặc biệt" }).click();
  await article.getByRole("checkbox", { name: collectionName }).check();
  await article.getByRole("button", { name: /^Lưu$/i }).click();
  await expect(article.getByRole("button", { name: "Thêm vào bộ đặc biệt" })).toBeVisible();
}
