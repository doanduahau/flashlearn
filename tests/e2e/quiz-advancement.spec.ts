import { expect, test } from "@playwright/test";

import { signUpAndConfirm, uniqueEmail } from "./support/auth-helpers";

const QUIZ_CSV = "tests/fixtures/quiz-cards.csv";

test("correct answers auto-advance while wrong answers wait for the learner", async ({ page }) => {
  await signUpAndConfirm(page, uniqueEmail("quiz_advance"));

  await page.goto("/import");
  await page.getByLabel(/CSV\/XLSX/i).setInputFiles(QUIZ_CSV);
  await page.getByLabel("Tên bộ").fill("Bộ kiểm tra điều hướng");
  await page.getByRole("button", { name: /Tạo bộ flashcard/i }).click();
  await expect(page).toHaveURL(/\/sets\/[0-9a-f-]+$/);

  await page.goto("/quiz");
  await expect(page.getByText("10 thẻ hợp lệ").filter({ visible: true })).toBeVisible();
  await page.getByRole("button", { name: "Bắt đầu kiểm tra" }).click();
  await expect(page).toHaveURL(/\/quiz\/[0-9a-f-]+$/);

  const heading = page.getByRole("heading", { level: 1 });
  const labels = page.locator("fieldset label");

  // Q1 answered correctly → advances without any further action
  const firstPrompt = (await heading.textContent()) ?? "";
  const firstAnswer = firstPrompt.replace("prompt", "answer");
  await labels.filter({ hasText: firstAnswer }).getByRole("radio").check();
  await page.getByRole("button", { name: "Xác nhận đáp án" }).click();
  await expect(page.getByRole("status")).toHaveText("Chính xác.");
  await expect(heading).not.toHaveText(firstPrompt);
  await expect(heading).toBeFocused();
  await expect(page.getByRole("status")).toHaveCount(0);

  // Q2 answered wrong → stays on the same question with a continue action
  const secondPrompt = (await heading.textContent()) ?? "";
  const secondAnswer = secondPrompt.replace("prompt", "answer");
  const answerCount = await labels.count();
  expect(answerCount).toBeGreaterThanOrEqual(2);
  expect(answerCount).toBeLessThanOrEqual(4);
  let selectedWrong = false;
  for (let index = 0; index < answerCount; index += 1) {
    const text = (await labels.nth(index).textContent())?.trim() ?? "";
    if (text !== secondAnswer) {
      await labels.nth(index).getByRole("radio").check();
      selectedWrong = true;
      break;
    }
  }
  expect(selectedWrong).toBe(true);
  await page.getByRole("button", { name: "Xác nhận đáp án" }).click();
  await expect(page.getByRole("status")).toHaveText("Chưa chính xác.");
  await expect(heading).toHaveText(secondPrompt);
  await expect(page.getByRole("button", { name: "Câu tiếp theo" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Xác nhận đáp án" })).toHaveCount(0);

  await page.getByRole("button", { name: "Câu tiếp theo" }).click();
  await expect(heading).not.toHaveText(secondPrompt);
  await expect(page.getByRole("status")).toHaveCount(0);
});
