import { expect, test, type Page } from "@playwright/test";

import { signUpAndConfirm, uniqueEmail } from "./support/auth-helpers";

type TabTarget = {
  label: string;
  value: string;
};

async function prepareScrollablePage(page: Page, href: string): Promise<void> {
  await page.goto(href);
  await expect(page.locator("header:visible, aside:visible")).toBeVisible();
  await page.evaluate(() => {
    document.body.style.minHeight = "2800px";
    window.scrollTo(0, 720);
  });
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(600);
}

async function switchTab(page: Page, navigationLabel: string, target: TabTarget): Promise<void> {
  const initialScrollY = await page.evaluate(() => window.scrollY);
  const appShell = page.locator("header:visible, aside:visible");
  const shellTop = await appShell.evaluate((element) => element.getBoundingClientRect().top);
  const clientNavigationMarker = crypto.randomUUID();
  await page.evaluate((marker) => {
    (window as Window & { internalTabNavigationMarker?: string }).internalTabNavigationMarker =
      marker;
  }, clientNavigationMarker);

  const tabLink = page
    .getByRole("navigation", { name: navigationLabel })
    .getByRole("link", { name: target.label });
  await tabLink.evaluate((link: HTMLAnchorElement) => link.click());
  await expect(tabLink).toHaveAttribute("aria-current", "page");
  await expect.poll(() => new URL(page.url()).searchParams.get("tab")).toBe(target.value);
  await expect(appShell).toBeVisible();
  expect(await appShell.evaluate((element) => element.getBoundingClientRect().top)).toBe(shellTop);
  expect(Math.abs((await page.evaluate(() => window.scrollY)) - initialScrollY)).toBeLessThan(24);
  expect(
    await page.evaluate(
      () =>
        (window as Window & { internalTabNavigationMarker?: string }).internalTabNavigationMarker,
    ),
  ).toBe(clientNavigationMarker);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
}

async function verifyTabNavigation(page: Page): Promise<void> {
  await prepareScrollablePage(page, "/sets?tab=regular&q=React&page=2");
  await switchTab(page, "Loại bộ flashcard", { label: "Bộ đặc biệt", value: "special" });
  const specialSetsUrl = new URL(page.url());
  expect(specialSetsUrl.searchParams.get("q")).toBe("React");
  expect(specialSetsUrl.searchParams.get("page")).toBe("2");
  await page.goBack();
  await expect.poll(() => new URL(page.url()).searchParams.get("tab")).toBe("regular");
  await switchTab(page, "Loại bộ flashcard", { label: "Bộ đặc biệt", value: "special" });
  await switchTab(page, "Loại bộ flashcard", { label: "Bộ thường", value: "regular" });

  await prepareScrollablePage(page, "/quiz?tab=create&q=React&sourceType=regular&page=2");
  await switchTab(page, "Nội dung kiểm tra", { label: "Lịch sử", value: "history" });
  const quizHistoryUrl = new URL(page.url());
  expect(quizHistoryUrl.searchParams.get("q")).toBe("React");
  expect(quizHistoryUrl.searchParams.get("sourceType")).toBe("regular");
  expect(quizHistoryUrl.searchParams.get("page")).toBe("2");
  await page.goBack();
  await expect.poll(() => new URL(page.url()).searchParams.get("tab")).toBe("create");
  await switchTab(page, "Nội dung kiểm tra", { label: "Lịch sử", value: "history" });
  await switchTab(page, "Nội dung kiểm tra", { label: "Tạo bài", value: "create" });

  await prepareScrollablePage(page, "/profile?tab=profile&month=2026-07");
  await switchTab(page, "Nội dung cá nhân", { label: "Thống kê", value: "statistics" });
  expect(new URL(page.url()).searchParams.get("month")).toBe("2026-07");
  await switchTab(page, "Nội dung cá nhân", { label: "Cài đặt", value: "settings" });
  await page.goBack();
  await expect.poll(() => new URL(page.url()).searchParams.get("tab")).toBe("statistics");
  await switchTab(page, "Nội dung cá nhân", { label: "Hồ sơ", value: "profile" });
}

test("internal tabs preserve scroll, URL state, and app shell on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signUpAndConfirm(page, uniqueEmail("internal_tabs_mobile"));

  await verifyTabNavigation(page);
});

test("internal tabs preserve scroll and use client navigation on desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signUpAndConfirm(page, uniqueEmail("internal_tabs_desktop"));

  await verifyTabNavigation(page);
});
