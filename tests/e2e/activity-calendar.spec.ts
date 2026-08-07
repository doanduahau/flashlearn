import { expect, test, type Page } from "@playwright/test";

import { signUpAndConfirm, TEST_PASSWORD, uniqueEmail } from "./support/auth-helpers";

const QUIZ_CSV = "tests/fixtures/quiz-cards.csv";
const DAY_CELL = 'button[aria-haspopup="dialog"]:not([disabled])';
const DAY_DETAIL = 'span[role="dialog"][aria-label="Chi tiết hoạt động"]';

async function completeTenQuestionQuiz(page: Page): Promise<void> {
  await page.goto("/import");
  await page.getByLabel(/CSV\/XLSX/i).setInputFiles(QUIZ_CSV);
  await page.getByLabel(/^4\./).fill("Bộ lịch hoạt động");
  await page.getByRole("button", { name: /Xác nhận import/i }).click();
  await expect(page).toHaveURL(/\/sets\/[0-9a-f-]+$/);

  await page.goto("/quiz");
  await expect(page.getByText("Có 10 thẻ hợp lệ trong phạm vi.")).toBeVisible();
  await page.getByRole("button", { name: "Bắt đầu kiểm tra" }).click();
  await expect(page).toHaveURL(/\/quiz\/[0-9a-f-]+$/);

  let previousPrompt = "";
  for (let index = 0; index < 10; index += 1) {
    const heading = page.getByRole("heading", { level: 1 });
    if (index > 0) {
      await expect(heading).not.toHaveText(previousPrompt);
    }
    previousPrompt = (await heading.textContent()) ?? "";

    await page.getByRole("radio").first().check();
    await page.getByRole("button", { name: "Xác nhận đáp án" }).click();
    await expect(page.getByRole("status")).toHaveText(/^(Chính xác|Chưa chính xác)\.$/);
    await page.getByRole("button", { name: index < 9 ? "Câu tiếp theo" : "Xem kết quả" }).click();
  }
  await expect(page).toHaveURL(/\/quiz\/[0-9a-f-]+\/result$/);
}

test.describe("Activity calendar interactions", () => {
  test("fine pointer: hover shows the detail, leaving hides it, focus shows it again", async ({
    page,
  }) => {
    await signUpAndConfirm(page, uniqueEmail("calendar_fine"));
    await completeTenQuestionQuiz(page);

    await page.goto("/profile?tab=statistics");
    const cell = page.locator(DAY_CELL).first();
    await expect(cell).toBeVisible();

    await cell.hover();
    await expect(cell.locator(DAY_DETAIL)).toBeVisible();

    await page.mouse.move(0, 0);
    await expect(cell.locator(DAY_DETAIL)).toBeHidden();

    await cell.focus();
    await expect(cell.locator(DAY_DETAIL)).toBeVisible();
  });

  test("coarse pointer: tapping a day opens its detail and tapping outside closes it", async ({
    browser,
  }) => {
    const desktop = await browser.newContext();
    const page = await desktop.newPage();
    const email = uniqueEmail("calendar_coarse");
    await signUpAndConfirm(page, email);
    await completeTenQuestionQuiz(page);

    const mobile = await browser.newContext({
      hasTouch: true,
      viewport: { width: 390, height: 844 },
    });
    await mobile.addInitScript(() => {
      const original = window.matchMedia.bind(window);
      window.matchMedia = (query: string): MediaQueryList => {
        const match = original(query);
        if (!query.includes("pointer")) return match;
        const matches = query.includes("coarse");
        return {
          get matches() {
            return matches;
          },
          media: query,
          onchange: null,
          addEventListener: (...args: Parameters<MediaQueryList["addEventListener"]>) =>
            match.addEventListener(...args),
          removeEventListener: (...args: Parameters<MediaQueryList["removeEventListener"]>) =>
            match.removeEventListener(...args),
          addListener: (...args: Parameters<MediaQueryList["addListener"]>) =>
            match.addListener(...args),
          removeListener: (...args: Parameters<MediaQueryList["removeListener"]>) =>
            match.removeListener(...args),
          dispatchEvent: (event: Event) => match.dispatchEvent(event),
        };
      };
    });
    const mpage = await mobile.newPage();
    await mpage.goto("/sign-in");
    await mpage.getByLabel("Email").fill(email);
    await mpage.getByRole("textbox", { name: "Mật khẩu" }).fill(TEST_PASSWORD);
    await mpage.getByRole("button", { name: /Đăng nhập/ }).click();
    await expect(mpage).toHaveURL(/\/dashboard$/);

    await mpage.goto("/profile?tab=statistics");
    const cell = mpage.locator(DAY_CELL).first();
    await expect(cell).toBeVisible();

    await cell.tap();
    await expect(cell.locator(DAY_DETAIL)).toBeVisible();

    await mpage.getByRole("heading", { level: 1 }).tap();
    await expect(cell.locator(DAY_DETAIL)).toBeHidden();
  });
});
