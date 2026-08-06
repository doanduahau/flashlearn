import { expect, test } from "@playwright/test";

import { signUpAndConfirm, uniqueEmail } from "./support/auth-helpers";

const QUIZ_CSV = "tests/fixtures/quiz-cards.csv";

test("quiz answers stay on the current question until the learner explicitly advances", async ({
  page,
}) => {
  await signUpAndConfirm(page, uniqueEmail("quiz_advance"));

  await page.goto("/import");
  await page.getByLabel(/CSV\/XLSX/i).setInputFiles(QUIZ_CSV);
  await page.getByLabel(/^4\./).fill("Bộ kiểm tra điều hướng");
  await page.getByRole("button", { name: /Xác nhận import/i }).click();
  await expect(page).toHaveURL(/\/sets\/[0-9a-f-]+$/);

  await page.goto("/quiz");
  await expect(page.getByText("Có 10 thẻ hợp lệ trong phạm vi.")).toBeVisible();
  await page.getByRole("button", { name: "Bắt đầu kiểm tra" }).click();
  await expect(page).toHaveURL(/\/quiz\/[0-9a-f-]+$/);

  const firstQuestion = page.getByRole("heading", { level: 1 });
  const firstPrompt = await firstQuestion.textContent();
  const firstOption = page.getByRole("radio").first();
  await firstOption.check();
  await page.getByRole("button", { name: "Xác nhận đáp án" }).click();

  await expect(page.getByRole("status")).toHaveText(/^(Chính xác|Chưa chính xác)\.$/);
  await expect(firstQuestion).toHaveText(firstPrompt ?? "");
  await expect(page.getByRole("button", { name: "Câu tiếp theo" })).toBeVisible();
  const answerCount = await page.getByRole("radio").count();
  expect(answerCount).toBeGreaterThanOrEqual(2);
  expect(answerCount).toBeLessThanOrEqual(4);
  expect(
    await page
      .getByRole("radio")
      .evaluateAll((radios) => radios.every((radio) => (radio as HTMLInputElement).disabled)),
  ).toBe(true);

  await page.waitForTimeout(250);
  await expect(firstQuestion).toHaveText(firstPrompt ?? "");

  await page.getByRole("button", { name: "Câu tiếp theo" }).click();
  await expect(firstQuestion).not.toHaveText(firstPrompt ?? "");
  await expect(firstQuestion).toBeFocused();
  expect(
    await page
      .getByRole("radio")
      .evaluateAll((radios) =>
        radios.every(
          (radio) => !(radio as HTMLInputElement).checked && !(radio as HTMLInputElement).disabled,
        ),
      ),
  ).toBe(true);
  await expect(page.getByRole("status")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Câu tiếp theo" })).toHaveCount(0);

  await page.getByRole("radio").first().check();
  await page.getByRole("button", { name: "Xác nhận đáp án" }).click();
  await expect(page.getByRole("status")).toHaveText(/^(Chính xác|Chưa chính xác)\.$/);
});
