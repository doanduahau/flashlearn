import { expect, test } from "@playwright/test";

import { signUpAndConfirm, uniqueEmail } from "./support/auth-helpers";

const QUIZ_CSV = "tests/fixtures/quiz-cards.csv";

test("typing mode lets the learner type answers and shows a graded result", async ({ page }) => {
  await signUpAndConfirm(page, uniqueEmail("typing_flow"));

  // Import a 10-card set.
  await page.goto("/sets/create?source=file");
  await page.getByLabel(/CSV\/XLSX/i).setInputFiles(QUIZ_CSV);
  await page.getByRole("button", { name: "Phân tích" }).click();
  await page.getByLabel("Tên bộ").fill("Bộ nhập đáp án");
  await page.getByRole("button", { name: /Tạo bộ flashcard/i }).click();
  await expect(page).toHaveURL(/\/sets\/[0-9a-f-]+$/);

  // /quiz/mode now offers the third card "Nhập đáp án".
  await page.goto("/quiz");
  await expect(page.getByRole("radio", { name: "Tất cả 10 thẻ" })).toBeChecked();
  await page.getByRole("button", { name: "Bắt đầu kiểm tra" }).click();
  await expect(page).toHaveURL(/\/quiz\/mode/);

  await expect(page.getByText("Nhập đáp án")).toBeVisible();
  await expect(page.getByText("Gõ đáp án theo cách của bạn")).toBeVisible();

  // Pick Nhập đáp án and start a 10-question session.
  await page.getByRole("button", { name: "Bắt đầu" }).last().click();
  await page.getByRole("button", { name: "10 câu" }).click();
  await page.getByRole("button", { name: "Bắt đầu" }).last().click();
  await expect(page).toHaveURL(/\/typing\/session/);
  await expect(page.getByText("Câu 1 / 10")).toBeVisible();

  // Answer the first question correctly.
  const answerInput = page.getByLabel("Đáp án cho câu 1");
  await expect(answerInput).toBeVisible();
  await answerInput.fill("Quiz answer 01");
  await page.getByRole("button", { name: "Câu sau" }).click();
  await expect(page.getByText("Câu 2 / 10")).toBeVisible();

  // Leave the second question empty to prove empty answers are graded wrong,
  // then navigate back and fill it.
  await page.getByRole("button", { name: "Câu trước" }).click();
  await expect(page.getByText("Câu 1 / 10")).toBeVisible();
  await expect(page.getByLabel("Đáp án cho câu 1")).toHaveValue("Quiz answer 01");
  await page.getByRole("button", { name: "Câu sau" }).click();

  // Fill the remaining questions with exact answers (Câu sau is disabled on
  // the last question, so it is only clicked from questions 2..9).
  for (let index = 2; index <= 9; index += 1) {
    await page
      .getByLabel(`Đáp án cho câu ${index}`)
      .fill(`Quiz answer ${String(index).padStart(2, "0")}`);
    await page.getByRole("button", { name: "Câu sau" }).click();
  }
  await page.getByLabel("Đáp án cho câu 10").fill("Quiz answer 10");
  await expect(page.getByText("Câu 10 / 10")).toBeVisible();

  // Submit and see the result screen (matching quiz-result styling).
  await page.getByRole("button", { name: "Nộp bài" }).click();
  await expect(page.getByText("Kết quả kiểm tra")).toBeVisible();
  await expect(page.getByText("10/10 đúng (100%)")).toBeVisible();
  await expect(page.getByRole("button", { name: "Chơi lại" })).toBeVisible();
  await expect(page.getByText("Đáp án của bạn: Quiz answer 01")).toBeVisible();
});

test("typing session warns before submitting with unanswered questions", async ({ page }) => {
  await signUpAndConfirm(page, uniqueEmail("typing_warn"));

  await page.goto("/sets/create?source=file");
  await page.getByLabel(/CSV\/XLSX/i).setInputFiles(QUIZ_CSV);
  await page.getByRole("button", { name: "Phân tích" }).click();
  await page.getByLabel("Tên bộ").fill("Bộ cảnh báo nhập đáp án");
  await page.getByRole("button", { name: /Tạo bộ flashcard/i }).click();
  await expect(page).toHaveURL(/\/sets\/[0-9a-f-]+$/);

  await page.goto("/quiz");
  await expect(page.getByRole("radio", { name: "Tất cả 10 thẻ" })).toBeChecked();
  await page.getByRole("button", { name: "Bắt đầu kiểm tra" }).click();
  await expect(page).toHaveURL(/\/quiz\/mode/);
  await page.getByRole("button", { name: "Bắt đầu" }).last().click();
  await page.getByRole("button", { name: "10 câu" }).click();
  await page.getByRole("button", { name: "Bắt đầu" }).last().click();
  await expect(page).toHaveURL(/\/typing\/session/);

  // Submit with everything empty → warning appears, nothing is submitted yet.
  await page.getByRole("button", { name: "Nộp bài" }).click();
  await expect(page.getByText(/Còn 10 câu chưa trả lời/)).toBeVisible();
  await expect(page.getByText("Kết quả kiểm tra")).toHaveCount(0);

  // Confirming again submits with empty answers graded wrong.
  await page.getByRole("button", { name: "Nộp bài" }).click();
  await expect(page.getByText("Kết quả kiểm tra")).toBeVisible();
  await expect(page.getByText("0/10 đúng (0%)")).toBeVisible();
});
