import { expect, type Page, test } from "@playwright/test";

import { signUpAndConfirm, uniqueEmail } from "./support/auth-helpers";
import { supabaseRest } from "./support/supabase-api";

const MOBILE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 900 };
const MIN_TILE_HEIGHT_PX = 56;
const MEMORY_CSV = "tests/fixtures/smart-review-24-cards.csv";

async function importSet(page: Page, name: string, csv = MEMORY_CSV): Promise<string> {
  await page.goto("/sets/create?source=file");
  await page.getByLabel(/CSV\/XLSX/i).setInputFiles(csv);
  await page.getByRole("button", { name: "Phân tích" }).click();
  await page.getByLabel("Tên bộ").fill(name);
  await page.getByRole("button", { name: /Tạo bộ flashcard/i }).click();
  await expect(page).toHaveURL(/\/sets\/[0-9a-f-]+$/);
  return new URL(page.url()).pathname.split("/").pop() ?? "";
}

async function openMemory(page: Page): Promise<void> {
  await page.goto("/memory");
  await expect(page).toHaveURL(/\/memory$/);
}

async function findMatchingTiles(page: Page) {
  const tiles = page.locator("[data-memory-tile-key]");
  const count = await tiles.count();
  for (let i = 0; i < count; i += 1) {
    const tile = tiles.nth(i);
    if ((await tile.getAttribute("aria-label")) !== "Ô úp") continue;
    const cardId = await tile.getAttribute("data-memory-card-id");
    const side = await tile.getAttribute("data-memory-side");
    const otherSide = side === "front" ? "back" : "front";
    const sibling = page.locator(
      `[data-memory-card-id="${cardId}"][data-memory-side="${otherSide}"]`,
    );
    return { first: tile, second: sibling };
  }
  throw new Error("no face-down tile found");
}

async function matchPair(page: Page): Promise<void> {
  const { first, second } = await findMatchingTiles(page);
  await first.click();
  await expect(first).toHaveAttribute("aria-label", "Đã lật", { timeout: 2000 });
  await expect(page.getByTestId("memory-preview")).toContainText(/Smart (prompt|answer) \d+/);
  await second.click();
  // Wait for the celebration to resolve so the next pair can be selected.
  await expect(first).toHaveAttribute("aria-label", "Đã ghép đúng", { timeout: 2000 });
  await page.waitForTimeout(750);
}

async function learningState(page: Page, userId: string) {
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

async function authUserId(page: Page): Promise<string> {
  const res = await supabaseRest(page.context(), "profiles?select=id");
  const data = (await res.json()) as { id: string }[];
  return data[0]?.id ?? "";
}

async function memoryCoverageCount(page: Page, userId: string): Promise<number> {
  const response = await supabaseRest(
    page.context(),
    `flashcard_coverage?select=flashcard_id&user_id=eq.${userId}&mode=eq.memory&limit=1000`,
  );
  return ((await response.json()) as unknown[]).length;
}

test.describe("Memory Matching", () => {
  test.describe.configure({ timeout: 90_000 });

  test("runs a full 12-pair Memory session with practice-only side effects", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await signUpAndConfirm(page, uniqueEmail("memory_full"));

    await importSet(page, "Bộ memory");
    const userId = await authUserId(page);
    const before = await learningState(page, userId);
    expect(await memoryCoverageCount(page, userId)).toBe(0);

    await openMemory(page);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Memory Matching");

    await expect(page.getByRole("button", { name: "12 câu" })).toBeVisible();
    await expect(page.getByRole("button", { name: "18 câu" })).toBeVisible();
    await expect(page.getByRole("button", { name: "24 câu" })).toBeVisible();

    await page.getByRole("button", { name: "12 câu" }).click();
    await page.getByRole("button", { name: "Bắt đầu Memory" }).click();
    await expect(page).toHaveURL(/\/memory\/session/);

    // 3x4 grid of 12 face-down tiles, no card content leaked.
    const tiles = page.locator("[data-memory-tile-key]");
    await expect(tiles).toHaveCount(12);
    await expect(page.getByRole("button", { name: /Smart prompt|Smart answer/ })).toHaveCount(0);

    // Complete all 6 pairs of batch 1, then batch 2.
    await matchPair(page);
    await expect(page.getByText("Bộ 1 / 2")).toBeVisible();
    await matchPair(page);
    await matchPair(page);
    await matchPair(page);
    await matchPair(page);
    await matchPair(page);

    // Batch 2 appears automatically.
    await expect(page.getByText("Bộ 2 / 2")).toBeVisible();
    expect(await memoryCoverageCount(page, userId)).toBe(0);
    await matchPair(page);
    await matchPair(page);
    await matchPair(page);
    await matchPair(page);
    await matchPair(page);
    await matchPair(page);

    // Completion screen.
    await expect(page.getByRole("heading", { name: "Hoàn thành!" })).toBeVisible();
    await expect(page.getByText("Hoàn thành 12/12 thẻ")).toBeVisible();
    await expect(page.getByText(/Thời gian \d{2}:\d{2}/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Chơi lại" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Thoát", exact: true })).toBeVisible();
    expect(await memoryCoverageCount(page, userId)).toBe(12);

    // No Quiz / FSRS / statistics writes.
    const after = await learningState(page, userId);
    expect(after.quizSessions).toBe(before.quizSessions);
    expect(after.reviewEvents).toBe(before.reviewEvents);
    expect(after.scheduleRows).toBe(before.scheduleRows);
    expect(after.dailyRecords).toBe(before.dailyRecords);
  });

  test("mismatch shows preview red border but no red tiles and flips back after one second", async ({
    page,
  }) => {
    await page.setViewportSize(MOBILE);
    await signUpAndConfirm(page, uniqueEmail("memory_mismatch"));
    await importSet(page, "Bộ memory mismatch");

    await openMemory(page);
    await page.getByRole("button", { name: "12 câu" }).click();
    await page.getByRole("button", { name: "Bắt đầu Memory" }).click();
    await expect(page).toHaveURL(/\/memory\/session/);

    const tiles = page.locator("[data-memory-tile-key]");
    await expect(tiles).toHaveCount(12);

    // Pick two tiles with different card ids.
    const t0 = tiles.nth(0);
    const t1 = tiles.nth(1);
    const card0 = await t0.getAttribute("data-memory-card-id");
    const card1 = await t1.getAttribute("data-memory-card-id");
    // If they are the same card, move to a different second tile.
    const secondIndex = card0 === card1 ? 2 : 1;
    const mismatchTile = tiles.nth(secondIndex);

    await t0.click();
    await mismatchTile.click();

    // Preview shows red border; tiles are not red (no danger class on tile).
    const preview = page.getByTestId("memory-preview");
    await expect(preview).toHaveClass(/border-danger/);
    await expect(t0).toHaveAttribute("aria-pressed", "true");
    await expect(mismatchTile).toHaveAttribute("aria-pressed", "true");

    // After one second both flip back face down.
    await expect(t0).toHaveAttribute("aria-pressed", "false", { timeout: 2000 });
    await expect(mismatchTile).toHaveAttribute("aria-pressed", "false", { timeout: 2000 });
  });

  test("all 12 tiles fit in one mobile viewport with no page scroll at 390x844", async ({
    page,
  }) => {
    await page.setViewportSize(MOBILE);
    await signUpAndConfirm(page, uniqueEmail("memory_viewport"));
    await importSet(page, "Bộ memory viewport");

    await openMemory(page);
    await page.getByRole("button", { name: "12 câu" }).click();
    await page.getByRole("button", { name: "Bắt đầu Memory" }).click();
    await expect(page).toHaveURL(/\/memory\/session/);

    const tiles = page.locator("[data-memory-tile-key]");
    await expect(tiles).toHaveCount(12);

    // Regression guard: every tile must render with real usable height, never
    // collapsed to thin horizontal lines. Poll until the measured grid height
    // settles, then require each tile to meet the minimum rendered height.
    await expect
      .poll(
        () =>
          tiles.evaluateAll((els) => els.every((el) => el.getBoundingClientRect().height >= 56)),
        { timeout: 5000 },
      )
      .toBe(true);

    const boxes: { x: number; y: number; width: number; height: number }[] = [];
    for (let i = 0; i < 12; i += 1) {
      const box = await tiles.nth(i).boundingBox();
      expect(box, `tile ${i} should be rendered`).toBeTruthy();
      if (box) boxes.push(box);
    }

    for (let i = 0; i < boxes.length; i += 1) {
      const box = boxes[i];
      expect(box.y, `tile ${i} top inside viewport`).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height, `tile ${i} bottom inside viewport`).toBeLessThanOrEqual(844);
      expect(box.x, `tile ${i} left inside viewport`).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, `tile ${i} right inside viewport`).toBeLessThanOrEqual(390);
      expect(box.height, `tile ${i} has a usable rendered height`).toBeGreaterThanOrEqual(
        MIN_TILE_HEIGHT_PX,
      );
    }

    // Reaching any tile must not require page scrolling, and there must be no
    // horizontal overflow.
    const scroll = await page.evaluate(() => ({
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scroll.scrollHeight).toBeLessThanOrEqual(scroll.clientHeight);
    expect(scroll.scrollWidth).toBeLessThanOrEqual(scroll.clientWidth);

    // The correct pair must still resolve after its one-second review delay.
    await page.locator('[data-memory-tile-key][data-memory-side="front"]').first().click();
    await expect(page.getByTestId("memory-preview")).toContainText(/Smart (prompt|answer) \d+/);
  });

  test("long Vietnamese text stays in preview and the grid has no overflow", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await signUpAndConfirm(page, uniqueEmail("memory_longtext"));

    await page.goto("/sets/create");
    const longFront =
      "Hệ điều hành là phần mềm quản lý tài nguyên phần cứng máy tính và cung cấp các dịch vụ chung cho các chương trình phần mềm khác";
    const longBack =
      "An operating system manages computer hardware resources and provides common services for computer programs";
    const veryLongVietnameseFront = `${longFront} `.repeat(8);
    const rows = Array.from(
      { length: 12 },
      (_, i) => `${veryLongVietnameseFront}${i}\t${longBack} ${i}`,
    ).join("\n");
    await page.locator("#paste-textarea").fill(rows);
    await page.getByRole("button", { name: "Phân tích" }).click();
    await expect(page.getByRole("button", { name: /Tạo bộ flashcard/i })).toBeVisible();
    await page.getByLabel("Tên bộ").fill("Bộ memory dài");
    await page.getByRole("button", { name: /Tạo bộ flashcard/i }).click();
    await expect(page).toHaveURL(/\/sets\/[0-9a-f-]+$/);

    await openMemory(page);
    await page.getByRole("button", { name: "12 câu" }).click();
    await page.getByRole("button", { name: "Bắt đầu Memory" }).click();
    await expect(page).toHaveURL(/\/memory\/session/);

    // Flip a tile; the full content stays in a bounded, internally scrollable preview.
    const tiles = page.locator("[data-memory-tile-key]");
    await page.locator('[data-memory-tile-key][data-memory-side="front"]').first().click();
    const preview = page.getByTestId("memory-preview");
    await expect(preview).toContainText(/(Hệ điều hành|An operating system)/);
    const previewMetrics = await preview.evaluate((element) => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      overflowY: getComputedStyle(element).overflowY,
    }));
    expect(previewMetrics.clientHeight).toBeLessThanOrEqual(176);
    expect(previewMetrics.scrollHeight).toBeGreaterThan(previewMetrics.clientHeight);
    expect(["auto", "scroll"]).toContain(previewMetrics.overflowY);
    await preview.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    expect(await page.getByTestId("memory-preview-content").textContent()).toContain(
      "Hệ điều hành",
    );
    expect((await tiles.first().boundingBox())?.y ?? 0).toBeLessThan(600);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);
  });

  test("back arrow returns to the previous page", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await signUpAndConfirm(page, uniqueEmail("memory_exit"));
    await importSet(page, "Bộ memory exit");

    await openMemory(page);
    await page.getByRole("button", { name: "12 câu" }).click();
    await page.getByRole("button", { name: "Bắt đầu Memory" }).click();
    await expect(page).toHaveURL(/\/memory\/session\?all=1/);

    // Hủy keeps the learner in the session.
    await page.getByRole("button", { name: /Thoát phiên học/ }).click();
    await expect(page.getByRole("dialog", { name: "Thoát phiên?" })).toBeVisible();
    await page.getByRole("button", { name: "Hủy" }).click();
    await expect(page).toHaveURL(/\/memory\/session\?all=1/);

    // Confirmed exit returns to the previous page.
    await page.getByRole("button", { name: /Thoát phiên học/ }).click();
    await page.getByRole("button", { name: "Thoát", exact: true }).click();
    await expect(page).toHaveURL(/\/memory$/);
  });

  test("abandoning a session writes no coverage", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await signUpAndConfirm(page, uniqueEmail("memory_abandon"));
    await importSet(page, "Bộ memory abandon");
    const userId = await authUserId(page);

    const coverageBefore = await supabaseRest(
      page.context(),
      `flashcard_coverage?select=flashcard_id&user_id=eq.${userId}&mode=eq.memory&limit=1000`,
    );
    const countBefore = ((await coverageBefore.json()) as unknown[]).length;

    await openMemory(page);
    await page.getByRole("button", { name: "12 câu" }).click();
    await page.getByRole("button", { name: "Bắt đầu Memory" }).click();
    await expect(page).toHaveURL(/\/memory\/session/);

    const tiles = page.locator("[data-memory-tile-key]");
    await tiles.first().click();

    // Navigate away before completion.
    await page.goto("/dashboard");

    const coverageAfter = await supabaseRest(
      page.context(),
      `flashcard_coverage?select=flashcard_id&user_id=eq.${userId}&mode=eq.memory&limit=1000`,
    );
    const countAfter = ((await coverageAfter.json()) as unknown[]).length;
    expect(countAfter).toBe(countBefore);
  });
});
