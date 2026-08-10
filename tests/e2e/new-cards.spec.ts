import { expect, type Page, test } from "@playwright/test";

import { signUpAndConfirm, uniqueEmail } from "./support/auth-helpers";
import { authSubject, localSupabaseAdminRest, supabaseRest } from "./support/supabase-api";

const MOBILE = { width: 390, height: 844 };
const NEW_CARDS_CSV = "tests/fixtures/smart-review-24-cards.csv";

async function importSet(page: Page, name: string): Promise<void> {
  await page.goto("/import");
  await page.getByLabel(/CSV\/XLSX/i).setInputFiles(NEW_CARDS_CSV);
  await page.getByLabel(/^4\./).fill(name);
  await page.getByRole("button", { name: /Xác nhận import/i }).click();
  await expect(page).toHaveURL(/\/sets\/[0-9a-f-]+$/);
}

async function getSessionOrigin(page: Page, sessionId: string): Promise<string> {
  const response = await supabaseRest(
    page.context(),
    `quiz_sessions?id=eq.${sessionId}&select=origin`,
  );
  expect(response.ok).toBe(true);
  return ((await response.json()) as Array<{ origin: string }>)[0]?.origin ?? "";
}

async function getQuestionTargetIds(page: Page, sessionId: string): Promise<string[]> {
  const response = await supabaseRest(
    page.context(),
    `quiz_questions?session_id=eq.${sessionId}&select=source_flashcard_id&order=position.asc`,
  );
  expect(response.ok).toBe(true);
  return ((await response.json()) as Array<{ source_flashcard_id: string }>).map(
    (question) => question.source_flashcard_id,
  );
}

async function getOrderedCardIds(page: Page): Promise<string[]> {
  const response = await supabaseRest(
    page.context(),
    "flashcards?select=id&order=created_at.asc,id.asc",
  );
  expect(response.ok).toBe(true);
  return ((await response.json()) as Array<{ id: string }>).map((card) => card.id);
}

async function seedDueCards(page: Page, cardIds: string[]): Promise<void> {
  const userId = await authSubject(page.context());
  const reviewEvents = await localSupabaseAdminRest("card_review_events", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(
      cardIds.map((flashcard_id) => ({
        user_id: userId,
        flashcard_id,
        source: "study_recall",
        is_correct: true,
        fsrs_rating: 3,
        reviewed_at: "2026-01-01T00:00:00.000Z",
      })),
    ),
  });
  expect(reviewEvents.ok).toBe(true);
  const events = (await reviewEvents.json()) as Array<{ id: string; flashcard_id: string }>;
  const eventByCard = new Map(events.map((event) => [event.flashcard_id, event.id]));

  const schedules = await localSupabaseAdminRest("card_learning_schedule", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(
      cardIds.map((flashcard_id) => ({
        user_id: userId,
        flashcard_id,
        state: 2,
        stability: 1,
        difficulty: 1,
        due: "2020-01-01T00:00:00.000Z",
        scheduled_days: 1,
        learning_steps: 0,
        reps: 1,
        lapses: 0,
        last_review: "2026-01-01T00:00:00.000Z",
        projection_revision: 0,
        processed_event_count: 1,
        last_processed_reviewed_at: "2026-01-01T00:00:00.000Z",
        last_processed_review_event_id: eventByCard.get(flashcard_id),
        algorithm: "fsrs-6",
        implementation: "ts-fsrs@5.4.1",
        parameter_set: "flashlearn-v1",
      })),
    ),
  });
  expect(schedules.ok).toBe(true);
}

async function answerQuestion(page: Page, wantCorrect: boolean): Promise<void> {
  await expect(page.getByRole("radio").first()).toBeEnabled();
  const prompt = (await page.getByRole("heading", { level: 1 }).textContent()) ?? "";
  const correctAnswer = prompt.replace("prompt", "answer");
  const choices = page.locator("fieldset label");
  let selected = false;

  for (let index = 0; index < (await choices.count()); index += 1) {
    const choice = (await choices.nth(index).textContent())?.trim() ?? "";
    if ((wantCorrect && choice === correctAnswer) || (!wantCorrect && choice !== correctAnswer)) {
      await choices.nth(index).getByRole("radio").check();
      selected = true;
      break;
    }
  }
  expect(selected).toBe(true);
  await page.getByRole("button", { name: "Xác nhận đáp án" }).click();
  await expect(page.getByRole("status")).toHaveText(wantCorrect ? "Chính xác." : "Chưa chính xác.");
  await page.getByRole("button", { name: /Câu tiếp theo|Xem kết quả/ }).click();
}

async function answerBatch(page: Page, count: number, firstCorrect = false): Promise<void> {
  for (let index = 0; index < count; index += 1) {
    await answerQuestion(page, firstCorrect && index === 0);
  }
}

async function startManualQuiz(page: Page): Promise<void> {
  await page.goto("/quiz");
  await page.getByRole("button", { name: "Bắt đầu kiểm tra" }).click();
  await expect(page).toHaveURL(/\/quiz\/[0-9a-f-]+$/);
}

test.describe("New Cards learning", () => {
  test("uses fresh full New Card totals and ordered max-10 continuation batches", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.setViewportSize(MOBILE);
    await signUpAndConfirm(page, uniqueEmail("new_cards"));
    await importSet(page, "Thẻ mới");

    const orderedIds = await getOrderedCardIds(page);
    await seedDueCards(page, orderedIds.slice(0, 2));
    const expectedNewIds = orderedIds.slice(2);

    await page.goto("/dashboard");
    const summary = page.getByRole("region", { name: "Tóm tắt trạng thái học" });
    await expect(summary.getByText("Cần ôn", { exact: true })).toBeVisible();
    await expect(summary.getByText("Chưa học", { exact: true })).toBeVisible();
    await expect(summary.getByText("22", { exact: true })).toBeVisible();
    await expect(summary.getByRole("button", { name: "Học thẻ mới" })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);

    await summary.getByRole("button", { name: "Học thẻ mới" }).click();
    await expect(page).toHaveURL(/\/quiz\/[0-9a-f-]+$/);
    const firstSessionId = new URL(page.url()).pathname.split("/").at(-1) ?? "";
    await expect(getSessionOrigin(page, firstSessionId)).resolves.toBe("new_cards");
    await expect(getQuestionTargetIds(page, firstSessionId)).resolves.toEqual(
      expectedNewIds.slice(0, 10),
    );

    await answerBatch(page, 10, true);
    await expect(page).toHaveURL(/\/quiz\/[0-9a-f-]+\/result$/);
    const firstContinuation = page.getByRole("region", { name: "Tiếp tục học thẻ mới" });
    await expect(firstContinuation.getByText("Còn 12 thẻ chưa học")).toBeVisible();
    await expect(firstContinuation.getByRole("button", { name: "Học tiếp" })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);

    await firstContinuation.getByRole("button", { name: "Học tiếp" }).click();
    await expect(page).toHaveURL(/\/quiz\/[0-9a-f-]+$/);
    const secondSessionId = new URL(page.url()).pathname.split("/").at(-1) ?? "";
    await expect(getSessionOrigin(page, secondSessionId)).resolves.toBe("new_cards");
    await expect(getQuestionTargetIds(page, secondSessionId)).resolves.toEqual(
      expectedNewIds.slice(10, 20),
    );

    await answerBatch(page, 10);
    await expect(page).toHaveURL(/\/quiz\/[0-9a-f-]+\/result$/);
    const secondContinuation = page.getByRole("region", { name: "Tiếp tục học thẻ mới" });
    await expect(secondContinuation.getByText("Còn 2 thẻ chưa học")).toBeVisible();
    await secondContinuation.getByRole("button", { name: "Học tiếp" }).click();

    await expect(page).toHaveURL(/\/quiz\/[0-9a-f-]+$/);
    const finalSessionId = new URL(page.url()).pathname.split("/").at(-1) ?? "";
    await expect(getQuestionTargetIds(page, finalSessionId)).resolves.toEqual(
      expectedNewIds.slice(20),
    );
    await answerBatch(page, 2);
    await expect(page).toHaveURL(/\/quiz\/[0-9a-f-]+\/result$/);
    const finalContinuation = page.getByRole("region", { name: "Tiếp tục học thẻ mới" });
    await expect(finalContinuation.getByText("Đã học hết thẻ mới")).toBeVisible();
    await expect(finalContinuation.getByRole("button", { name: "Học tiếp" })).toHaveCount(0);
  });

  test("keeps a manual Quiz result free of New Cards continuation", async ({ page }) => {
    await signUpAndConfirm(page, uniqueEmail("new_cards_manual"));
    await importSet(page, "Kiểm tra thường");
    await startManualQuiz(page);
    await answerBatch(page, 10);
    await expect(page).toHaveURL(/\/quiz\/[0-9a-f-]+\/result$/);
    await expect(page.getByRole("region", { name: "Tiếp tục học thẻ mới" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Học tiếp" })).toHaveCount(0);
  });
});
