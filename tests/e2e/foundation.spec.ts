import { expect, test } from "@playwright/test";

const PUBLIC_ROUTES = [
  { path: "/", heading: "FlashLearn" },
  { path: "/sign-in", heading: "Đăng nhập" },
  { path: "/sign-up", heading: "Tạo tài khoản" },
];

const APP_ROUTES = [
  { path: "/dashboard", heading: "Dashboard" },
  { path: "/import", heading: "Import" },
  { path: "/sets", heading: "Bộ flashcard" },
  { path: "/collections", heading: "Bộ đặc biệt" },
  { path: "/study", heading: "Học" },
  { path: "/quiz", heading: "Kiểm tra" },
  { path: "/history", heading: "Lịch sử" },
  { path: "/statistics", heading: "Thống kê" },
  { path: "/settings", heading: "Cài đặt" },
];

const ALL_ROUTES = [...PUBLIC_ROUTES, ...APP_ROUTES];

test.describe("Foundation Routes & Errors", () => {
  ALL_ROUTES.forEach(({ path, heading }) => {
    test(`route ${path} renders correctly without errors`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (err) => errors.push(`Page error: ${err.message}`));
      page.on("console", (msg) => {
        if (msg.type() === "error") {
          errors.push(`Console error: ${msg.text()}`);
        }
      });

      const response = await page.goto(path);
      expect(response?.status()).toBe(200);

      const headingLocator = page.getByRole("heading", { level: 1 });
      await expect(headingLocator).toContainText(heading);

      expect(errors).toHaveLength(0);
    });
  });

  test("unknown route renders 404", async ({ page }) => {
    const response = await page.goto("/unknown-route-12345");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("404");
  });
});

test.describe("Navigation & Layout", () => {
  test("sidebar navigation works and highlights active route", async ({ page }) => {
    // Set desktop viewport
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/dashboard");

    const sidebar = page.locator("aside");
    await expect(sidebar).toBeVisible();

    // Verify a link points to the correct route
    const setsLink = sidebar.getByRole("link", { name: "Bộ Flashcard" });
    await expect(setsLink).toHaveAttribute("href", "/sets");

    // Navigate to sets
    await setsLink.click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Bộ flashcard");

    // The Sets link should now be active (have specific background/text colors)
    // Testing the active class might be fragile, but it should contain the active styling classes
    await expect(setsLink).toHaveClass(/bg-primary-soft/);
  });

  test("mobile bottom navigation points to correct routes", async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/dashboard");

    const bottomNav = page.locator("nav").last(); // Assuming bottom nav is the last nav element
    await expect(bottomNav).toBeVisible();

    // Verify a link points to the correct route
    const importLink = bottomNav.getByRole("link", { name: "Import" });
    await expect(importLink).toHaveAttribute("href", "/import");

    await importLink.click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Import");
  });

  test("logo navigates without document reload", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/sets");

    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame() && frame.url().endsWith("/dashboard")) {
        // If it's a hard navigation, we might catch it, but a better way is to set a variable in the window
      }
    });

    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__NAV_TEST = true;
    });

    const logoLink = page.locator("aside").getByRole("link", { name: /FlashLearn/i });
    await logoLink.click();

    await expect(page.getByRole("heading", { level: 1 })).toContainText("Dashboard");

    // Verify window variable is still there (meaning no hard reload)
    const navTest = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (window as any).__NAV_TEST;
    });
    expect(navTest).toBe(true);
  });
});

const VIEWPORTS = [
  { width: 375, height: 812, name: "Mobile" },
  { width: 768, height: 1024, name: "Tablet Portrait (md break)" },
  { width: 1024, height: 768, name: "Tablet Landscape" },
  { width: 1440, height: 900, name: "Desktop" },
];

test.describe("Responsive Layout", () => {
  for (const vp of VIEWPORTS) {
    test(`renders correctly at ${vp.width}x${vp.height} (${vp.name})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/dashboard");

      const sidebar = page.locator("aside");
      const mobileHeader = page.locator("header");
      const bottomNav = page.locator(".fixed.inset-x-0.bottom-0");
      const mainContent = page.locator("main");

      if (vp.width < 768) {
        // Mobile layout
        await expect(sidebar).toBeHidden();
        await expect(mobileHeader).toBeVisible();
        await expect(bottomNav).toBeVisible();

        // Check horizontal overflow
        const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
        const windowWidth = await page.evaluate(() => window.innerWidth);
        expect(bodyWidth).toBeLessThanOrEqual(windowWidth);
      } else {
        // Desktop layout
        await expect(sidebar).toBeVisible();
        await expect(mobileHeader).toBeHidden();
        await expect(bottomNav).toBeHidden();

        // Check sidebar offset (main content shouldn't overlap sidebar)
        const sidebarBox = await sidebar.boundingBox();
        const mainBox = await mainContent.boundingBox();

        if (sidebarBox && mainBox) {
          expect(mainBox.x).toBeGreaterThanOrEqual(sidebarBox.x + sidebarBox.width);
        }

        const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
        const windowWidth = await page.evaluate(() => window.innerWidth);
        expect(bodyWidth).toBeLessThanOrEqual(windowWidth);
      }
    });
  }
});

test.describe("Accessibility & Interactions", () => {
  test("internal links are keyboard reachable and focus is visible", async ({ page }) => {
    await page.goto("/");

    // Press Tab to focus the first interactive element
    await page.keyboard.press("Tab");

    // Check if the focused element has a visible focus ring
    const focusedOutline = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return "";
      const style = window.getComputedStyle(el);
      // Tailwind uses outline or box-shadow (ring) for focus
      return style.outlineStyle !== "none" || style.boxShadow !== "none" ? "visible" : "none";
    });

    expect(focusedOutline).toBe("visible");
  });
});
