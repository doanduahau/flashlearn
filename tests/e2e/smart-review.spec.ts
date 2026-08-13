import { expect, type Page, test } from "@playwright/test";

import { signUpAndConfirm, uniqueEmail } from "./support/auth-helpers";
import { localSupabaseAdminRest, supabaseRest } from "./support/supabase-api";

const MOBILE = { width: 390, height: 844 };
const QUIZ_CSV = "tests/fixtures/quiz-cards.csv";
const SMART_REVIEW_24_CSV = "tests/fixtures/smart-review-24-cards.csv";

async function importSet(page: Page, name: string, csv = QUIZ_CSV): Promise<void> {
  await page.goto("/import");
  await page.getByLabel(/CSV\/XLSX/i).setInputFiles(csv);
  await page.getByLabel("Tên bộ").fill(name);
  await page.getByRole("button", { name: /Tạo bộ flashcard/i }).click();
  await expect(page).toHaveURL(/\/sets\/[0-9a-f-]+$/);
}

async function answerQuestion(page: Page, wantCorrect: boolean): Promise<void> {
  await expect(page.getByRole("status")).toHaveCount(0);
  await expect(page.getByRole("radio").first()).toBeEnabled();
  const heading = page.getByRole("heading", { level: 1 });
  const prompt = (await heading.textContent()) ?? "";
  const correctAnswer = prompt.replace("prompt", "answer");
  const answers = page.locator("fieldset label");
  let selected = false;

  for (let index = 0; index < (await answers.count()); index += 1) {
    const isCorrectAnswer =
      ((await answers.nth(index).textContent()) ?? "").trim() === correctAnswer;
    if (isCorrectAnswer === wantCorrect) {
      const radio = answers.nth(index).getByRole("radio");
      await radio.check();
      await expect(radio).toBeChecked();
      selected = true;
      break;
    }
  }

  expect(selected).toBe(true);

  await page.getByRole("button", { name: "Xác nhận đáp án" }).click();
  await expect(page.getByRole("status")).toHaveText(wantCorrect ? "Chính xác." : "Chưa chính xác.");
  const next = page.getByRole("button", { name: /Câu tiếp theo|Xem kết quả/ });
  if (await next.isVisible()) await next.click();
}

async function answerEveryQuestionWrong(page: Page, count = 10): Promise<void> {
  for (let index = 0; index < count; index += 1) {
    await answerQuestion(page, false);
  }
}

async function answerEveryQuestionCorrect(page: Page): Promise<void> {
  for (let index = 0; index < 10; index += 1) {
    await answerQuestion(page, true);
  }
}

async function startManualQuiz(page: Page, useAllAvailableCards = false): Promise<string> {
  await page.goto("/quiz");
  if (useAllAvailableCards) {
    await page.getByRole("button", { name: /Tất cả \(24\)/ }).click();
  }
  await page.getByRole("button", { name: "Bắt đầu kiểm tra" }).click();
  await expect(page).toHaveURL(/\/quiz\/[0-9a-f-]+$/);
  return new URL(page.url()).pathname.split("/").at(-1) ?? "";
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

async function getTargetSetIds(page: Page, cardIds: string[]): Promise<string[]> {
  const response = await supabaseRest(
    page.context(),
    `flashcards?id=in.(${cardIds.join(",")})&select=set_id`,
  );
  expect(response.ok).toBe(true);
  return ((await response.json()) as Array<{ set_id: string }>).map((card) => card.set_id);
}

async function makeSchedulesDue(cardIds: string[]): Promise<void> {
  const response = await localSupabaseAdminRest(
    `card_learning_schedule?flashcard_id=in.(${cardIds.join(",")})`,
    {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ due: "2020-01-01T00:00:00.000Z" }),
    },
  );
  expect(response.ok).toBe(true);
}

test.describe("Smart Review session", () => {
  test("starts an urgent multi-set batch from Dashboard and keeps normal quiz learning records", async ({
    page,
  }) => {
    await page.setViewportSize(MOBILE);
    await signUpAndConfirm(page, uniqueEmail("smart_review"));
    await importSet(page, "Ôn tập A");
    await importSet(page, "Ôn tập B");

    await page.goto("/dashboard");
    await expect(page.getByRole("button", { name: "Ôn ngay" })).toHaveCount(0);

    // Seed ten review candidates through the existing Quiz flow.
    const seededSessionId = await startManualQuiz(page);
    await answerEveryQuestionWrong(page);
    await expect(page).toHaveURL(/\/quiz\/[0-9a-f-]+\/result$/);
    const seededTargetIds = await getQuestionTargetIds(page, seededSessionId);
    expect(seededTargetIds).toHaveLength(10);
    expect(new Set(await getTargetSetIds(page, seededTargetIds)).size).toBeGreaterThan(1);
    await expect(getSessionOrigin(page, seededSessionId)).resolves.toBe("manual");
    await makeSchedulesDue(seededTargetIds);

    await page.goto("/dashboard");
    const summary = page.getByRole("region", { name: "Tóm tắt trạng thái học" });
    await expect(summary.getByText("Cần ôn", { exact: true })).toBeVisible();
    await expect(summary.getByRole("button", { name: "Ôn ngay" })).toBeVisible();
    await expect(summary.getByText(/%|score|điểm|phần trăm/i)).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
    expect(
      (await page.getByRole("heading", { name: "Hoạt động tháng này" }).boundingBox())?.y ?? 999,
    ).toBeLessThan(520);

    await summary.getByRole("button", { name: "Ôn ngay" }).click();
    await expect(page).toHaveURL(/\/quiz\/[0-9a-f-]+$/);
    const smartSessionId = new URL(page.url()).pathname.split("/").at(-1) ?? "";
    await expect(getSessionOrigin(page, smartSessionId)).resolves.toBe("smart_review");
    const smartTargetIds = await getQuestionTargetIds(page, smartSessionId);
    expect(smartTargetIds).toEqual(expect.arrayContaining(seededTargetIds));
    expect(smartTargetIds).toHaveLength(10);

    await answerEveryQuestionWrong(page);
    await expect(page).toHaveURL(/\/quiz\/[0-9a-f-]+\/result$/);

    const eventsResponse = await supabaseRest(
      page.context(),
      `card_review_events?quiz_session_id=eq.${smartSessionId}&select=flashcard_id`,
    );
    expect(eventsResponse.ok).toBe(true);
    const eventIds = ((await eventsResponse.json()) as Array<{ flashcard_id: string }>).map(
      (event) => event.flashcard_id,
    );
    expect(eventIds).toHaveLength(10);
    expect(eventIds).toEqual(expect.arrayContaining(smartTargetIds));
    await makeSchedulesDue(smartTargetIds);

    await page.goto("/dashboard");
    await expect(summary.getByText("Cần ôn", { exact: true })).toBeVisible();
    await expect(summary.getByRole("button", { name: "Ôn ngay" })).toBeVisible();
  });

  test("uses fresh FSRS due count after a batch and starts continuation from fresh candidates", async ({
    page,
  }) => {
    test.setTimeout(45_000);
    await page.setViewportSize(MOBILE);
    await signUpAndConfirm(page, uniqueEmail("smart_review_continue"));
    await importSet(page, "Ôn tiếp", SMART_REVIEW_24_CSV);

    const seededSessionId = await startManualQuiz(page, true);
    await answerEveryQuestionWrong(page, 24);
    await expect(page).toHaveURL(/\/quiz\/[0-9a-f-]+\/result$/);
    await makeSchedulesDue(await getQuestionTargetIds(page, seededSessionId));

    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Ôn ngay" }).click();
    await expect(page).toHaveURL(/\/quiz\/[0-9a-f-]+$/);
    const smartSessionId = new URL(page.url()).pathname.split("/").at(-1) ?? "";
    const firstBatchIds = await getQuestionTargetIds(page, smartSessionId);

    for (let index = 0; index < 6; index += 1) {
      await answerQuestion(page, true);
    }
    for (let index = 6; index < 10; index += 1) {
      await answerQuestion(page, false);
    }
    await expect(page).toHaveURL(/\/quiz\/[0-9a-f-]+\/result$/);

    const continuation = page.getByRole("region", { name: "Tiếp tục ôn thông minh" });
    await expect(continuation).toBeVisible();
    await expect(page.getByRole("region", { name: "Tiếp tục học thẻ mới" })).toHaveCount(0);
    // After completing the first 10-card batch, the 14 untouched cards remain
    // due and the 10 answered cards have new future schedules, so the fresh
    // full FSRS due total is 14 (not a capped batch size).
    await expect(continuation.getByText("Còn 14 thẻ cần ôn")).toBeVisible();
    await expect(continuation.getByText("Còn 18 thẻ cần ôn")).toHaveCount(0);
    await expect(continuation.getByRole("button", { name: "Ôn tiếp" })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
    expect((await continuation.boundingBox())?.y ?? 999).toBeLessThan(520);

    await continuation.getByRole("button", { name: "Ôn tiếp" }).click();
    await expect(page).toHaveURL(/\/quiz\/[0-9a-f-]+$/);
    const continuedSessionId = new URL(page.url()).pathname.split("/").at(-1) ?? "";
    await expect(getSessionOrigin(page, continuedSessionId)).resolves.toBe("smart_review");
    const continuedTargets = await getQuestionTargetIds(page, continuedSessionId);
    expect(continuedTargets).not.toEqual(firstBatchIds);
    expect(continuedTargets.filter((id) => firstBatchIds.includes(id))).toEqual([]);
  });

  test("shows the finished state when the fresh FSRS due count is zero", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await signUpAndConfirm(page, uniqueEmail("smart_review_complete"));
    await importSet(page, "Ôn xong");

    const seededSessionId = await startManualQuiz(page);
    await answerEveryQuestionWrong(page);
    await expect(page).toHaveURL(/\/quiz\/[0-9a-f-]+\/result$/);
    await makeSchedulesDue(await getQuestionTargetIds(page, seededSessionId));

    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Ôn ngay" }).click();
    await expect(page).toHaveURL(/\/quiz\/[0-9a-f-]+$/);
    await answerEveryQuestionCorrect(page);
    await expect(page).toHaveURL(/\/quiz\/[0-9a-f-]+\/result$/);

    const continuation = page.getByRole("region", { name: "Tiếp tục ôn thông minh" });
    await expect(continuation.getByText("Đã ôn xong hôm nay")).toBeVisible();
    await expect(continuation.getByRole("button", { name: "Ôn tiếp" })).toHaveCount(0);
  });

  test("keeps a manual quiz result free of Smart Review continuation UI", async ({ page }) => {
    await signUpAndConfirm(page, uniqueEmail("manual_result"));
    await importSet(page, "Kiểm tra thường");

    const manualSessionId = await startManualQuiz(page);
    await answerEveryQuestionWrong(page);
    await expect(page).toHaveURL(/\/quiz\/[0-9a-f-]+\/result$/);
    await expect(getSessionOrigin(page, manualSessionId)).resolves.toBe("manual");
    await expect(page.getByRole("region", { name: "Tiếp tục ôn thông minh" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Ôn tiếp" })).toHaveCount(0);
    await expect(page.getByText("Đã ôn xong hôm nay")).toHaveCount(0);
  });
});
