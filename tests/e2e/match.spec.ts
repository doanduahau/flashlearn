import { expect, type Page, test } from "@playwright/test";

import { signUpAndConfirm, uniqueEmail } from "./support/auth-helpers";
import { supabaseRest } from "./support/supabase-api";

const MOBILE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 900 };
const MATCH_CSV = "tests/fixtures/smart-review-24-cards.csv";

async function importSet(page: Page, name: string, csv = MATCH_CSV): Promise<string> {
  await page.goto("/import");
  await page.getByLabel(/CSV\/XLSX/i).setInputFiles(csv);
  await page.getByLabel("Tên bộ").fill(name);
  await page.getByRole("button", { name: /Tạo bộ flashcard/i }).click();
  await expect(page).toHaveURL(/\/sets\/[0-9a-f-]+$/);
  return new URL(page.url()).pathname.split("/").pop() ?? "";
}

async function clickCorrectPair(page: Page): Promise<string> {
  const frontButtons = page.getByRole("button", { name: /^Smart prompt \d+$/ });
  let frontIndex = -1;
  for (let i = 0; i < (await frontButtons.count()); i += 1) {
    if (await frontButtons.nth(i).isEnabled()) {
      frontIndex = i;
      break;
    }
  }
  expect(frontIndex).toBeGreaterThanOrEqual(0);
  const front = frontButtons.nth(frontIndex);
  await expect(front).toBeVisible();
  const frontText = (await front.textContent()) ?? "";
  const match = frontText.match(/^Smart prompt (\d+)$/);
  expect(match).toBeTruthy();
  const number = match?.[1] ?? "";
  const backText = `Smart answer ${number}`;
  await front.click();
  const back = page.getByRole("button", { name: backText, exact: true });
  await back.click();
  return number;
}

async function completeBatch(page: Page, pairCount: number): Promise<void> {
  for (let index = 0; index < pairCount; index += 1) {
    await clickCorrectPair(page);
  }
}

test.describe("Match learning mode", () => {
  test("runs a full 12-pair Match session with side-effect-free practice", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await signUpAndConfirm(page, uniqueEmail("match_full"));

    await importSet(page, "Bộ match");
    const userId = await authUserId(page);

    // Capture learning state before Match.
    const before = await learningState(page, userId);

    await page.goto("/match");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Kiểm tra");
    await expect(page.getByRole("link", { name: "Match" })).toHaveAttribute("aria-current", "page");

    // 24 eligible cards -> all three options available.
    await expect(page.getByRole("button", { name: "12 câu" })).toBeVisible();
    await expect(page.getByRole("button", { name: "18 câu" })).toBeVisible();
    await expect(page.getByRole("button", { name: "24 câu" })).toBeVisible();

    await page.getByRole("button", { name: "12 câu" }).click();
    await page.getByRole("button", { name: "Bắt đầu Match" }).click();
    await expect(page).toHaveURL(/\/match\/session/);

    // First batch: 6 fronts + 6 backs.
    await expect(page.getByRole("button", { name: /^Smart prompt \d+$/ }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /^Smart answer \d+$/ }).first()).toBeVisible();

    // A wrong pair clears selection without completing either card.
    const frontButtons = page.getByRole("button", { name: /^Smart prompt \d+$/ });
    let wrongFrontIndex = -1;
    for (let i = 0; i < (await frontButtons.count()); i += 1) {
      if (await frontButtons.nth(i).isEnabled()) {
        wrongFrontIndex = i;
        break;
      }
    }
    expect(wrongFrontIndex).toBeGreaterThanOrEqual(0);
    const wrongFront = frontButtons.nth(wrongFrontIndex);
    const wrongFrontText = (await wrongFront.textContent()) ?? "";
    const wrongNumber = wrongFrontText.match(/\d+/)?.[0] ?? "01";
    const correctBackText = `Smart answer ${wrongNumber}`;

    // Click a back that is enabled and NOT the matching answer.
    const backButtons = page.getByRole("button", { name: /^Smart answer \d+$/ });
    let wrongBackIndex = -1;
    for (let i = 0; i < (await backButtons.count()); i += 1) {
      const text = (await backButtons.nth(i).textContent()) ?? "";
      if ((await backButtons.nth(i).isEnabled()) && text.trim() !== correctBackText) {
        wrongBackIndex = i;
        break;
      }
    }
    expect(wrongBackIndex).toBeGreaterThanOrEqual(0);
    const wrongBack = backButtons.nth(wrongBackIndex);
    const wrongBackText = (await wrongBack.textContent()) ?? "";

    await wrongFront.click();
    await wrongBack.click();
    await expect(page.getByText("Chưa đúng, thử cặp khác.")).toBeVisible();
    await expect(wrongFront).toBeEnabled();
    await expect(page.getByRole("button", { name: wrongBackText, exact: true })).toBeEnabled();

    // Complete the first batch (6 pairs).
    await completeBatch(page, 6);
    await expect(page.getByText("Bộ 2 / 2")).toBeVisible();
    await expect(page.getByText("Đã nối 6 / 12")).toBeVisible();

    // Complete the final batch.
    await completeBatch(page, 6);
    await expect(page.getByRole("heading", { name: "Hoàn thành 12/12" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Chơi lại" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Quay lại" })).toBeVisible();

    // Replay starts a fresh playable session.
    await page.getByRole("button", { name: "Chơi lại" }).click();
    await expect(page.getByRole("button", { name: /^Smart prompt \d+$/ }).first()).toBeVisible();
    await expect(page.getByText("Bộ 1 / 2")).toBeVisible();

    // No learning state changed.
    const after = await learningState(page, userId);
    expect(after.quizSessions).toBe(before.quizSessions);
    expect(after.reviewEvents).toBe(before.reviewEvents);
    expect(after.scheduleRows).toBe(before.scheduleRows);
    expect(after.dailyRecords).toBe(before.dailyRecords);
  });

  test("shows Match unavailable message for a set with fewer than 12 cards", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await signUpAndConfirm(page, uniqueEmail("match_insufficient"));

    await importSet(page, "Bộ nhỏ", "tests/fixtures/quiz-cards.csv");

    await page.goto("/match");
    await expect(page.getByText("Match yêu cầu ít nhất 12 thẻ có thể ghép rõ ràng.")).toBeVisible();
    await expect(page.getByRole("button", { name: "12 câu" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Bắt đầu Match" })).toBeDisabled();
  });

  test("long text cards wrap and do not cause horizontal overflow", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await signUpAndConfirm(page, uniqueEmail("match_longtext"));

    // Create a set with long text via the paste editor.
    await page.goto("/sets?create=paste");
    const longFront =
      "Hệ điều hành là phần mềm quản lý tài nguyên phần cứng máy tính và cung cấp các dịch vụ chung cho các chương trình phần mềm khác";
    const longBack =
      "An operating system manages computer hardware resources and provides common services for computer programs";
    const longToken = "x".repeat(320);
    const rows = Array.from(
      { length: 12 },
      (_, i) => `${longFront} ${i} ${longToken}${i}\t${longBack} ${i} ${longToken}${i}`,
    ).join("\n");
    await page.locator("#paste-textarea").fill(rows);
    await page.getByRole("button", { name: "Phân tích" }).click();
    await expect(page.getByRole("button", { name: /Tạo bộ flashcard/i })).toBeVisible();
    await page.getByLabel("Tên bộ").fill("Bộ chữ dài");
    await page.getByRole("button", { name: /Tạo bộ flashcard/i }).click();
    await expect(page).toHaveURL(/\/sets\/[0-9a-f-]+$/);

    // A fixed session seed gives one Front near the top whose matching Back is
    // lower in the independently shuffled column.
    await page.addInitScript(() => {
      Math.random = () => 0.25;
    });
    await page.goto("/match");
    await page.getByRole("button", { name: "12 câu" }).click();
    await page.getByRole("button", { name: "Bắt đầu Match" }).click();
    await expect(page).toHaveURL(/\/match\/session/);

    await expect(page.getByRole("button", { name: /Hệ điều hành/ }).first()).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);

    const scrollTargetId = await page
      .locator('[data-match-side="front"]')
      .first()
      .getAttribute("data-match-card-id");
    expect(scrollTargetId).toBeTruthy();
    if (!scrollTargetId) return;

    const front = page.locator(`[data-match-side="front"][data-match-card-id="${scrollTargetId}"]`);
    const back = page.locator(`[data-match-side="back"][data-match-card-id="${scrollTargetId}"]`);
    await front.click();
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    await back.scrollIntoViewIfNeeded();
    await expect(back).toBeVisible();
    await back.click();
    await expect(front).toBeDisabled();
    await expect(back).toBeDisabled();
  });

  test("uses independent deterministic Front and Back orderings", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await signUpAndConfirm(page, uniqueEmail("match_independent_shuffle"));
    await importSet(page, "Bộ Match độc lập");

    // Keep the session seed deterministic. The UI must still use distinct
    // random streams for the two columns rather than replaying one permutation.
    await page.addInitScript(() => {
      Math.random = () => 0.25;
    });

    await page.goto("/match");
    await page.getByRole("button", { name: "12 câu" }).click();
    await page.getByRole("button", { name: "Bắt đầu Match" }).click();
    await expect(page).toHaveURL(/\/match\/session/);
    await expect(page.locator('[data-match-side="front"]').first()).toBeVisible();

    const frontOrder = await page
      .locator('[data-match-side="front"]')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-match-card-id")));
    const backOrder = await page
      .locator('[data-match-side="back"]')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-match-card-id")));

    expect(frontOrder).toHaveLength(6);
    expect(backOrder).toHaveLength(6);
    expect(frontOrder).not.toEqual(backOrder);
  });
});

async function authUserId(page: Page): Promise<string> {
  const res = await supabaseRest(page.context(), "profiles?select=id");
  const data = (await res.json()) as { id: string }[];
  return data[0]?.id ?? "";
}

async function learningState(
  page: Page,
  userId: string,
): Promise<{
  quizSessions: number;
  reviewEvents: number;
  scheduleRows: number;
  dailyRecords: number;
}> {
  const [sessions, events, schedule, daily] = await Promise.all([
    supabaseRest(page.context(), `quiz_sessions?select=id&user_id=eq.${userId}&limit=1000`),
    supabaseRest(page.context(), `card_review_events?select=id&user_id=eq.${userId}&limit=1000`),
    supabaseRest(
      page.context(),
      `card_learning_schedule?select=id&user_id=eq.${userId}&limit=1000`,
    ),
    supabaseRest(
      page.context(),
      `daily_learning_records?select=id&user_id=eq.${userId}&limit=1000`,
    ),
  ]);
  const count = async (res: Response) => ((await res.json()) as unknown[]).length;
  return {
    quizSessions: await count(sessions),
    reviewEvents: await count(events),
    scheduleRows: await count(schedule),
    dailyRecords: await count(daily),
  };
}
