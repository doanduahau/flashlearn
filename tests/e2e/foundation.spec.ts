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

test.describe("Foundation Routes & Errors", () => {
  PUBLIC_ROUTES.forEach(({ path, heading }) => {
    test(`public route ${path} renders correctly without errors`, async ({ page }) => {
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

  test("unauthenticated app routes redirect to sign-in", async ({ page }) => {
    const response = await page.goto("/dashboard");
    expect(response?.status()).toBe(200);
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fdashboard/);
  });

  test("unknown route renders the not-found experience", async ({ page }) => {
    const response = await page.goto("/unknown-route-12345");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("404");
  });
});

test.describe("Authenticated Routes", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().addCookies([
      {
        name: "__unoptimized",
        value: "1",
        domain: "localhost",
        path: "/",
      },
    ]);
  });

  for (const { path } of APP_ROUTES) {
    test(`authenticated route ${path} redirects to sign-in when not authenticated`, async ({
      page,
    }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/sign-in\?next=/);
      const url = new URL(page.url());
      expect(url.searchParams.get("next")).toBe(path);
    });
  }
});

test.describe("Navigation & Layout (Authenticated)", () => {
  test("check-email page renders correctly", async ({ page }) => {
    await page.goto("/check-email");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Kiểm tra email");
  });

  test("auth error page renders correctly", async ({ page }) => {
    await page.goto("/auth/error?error=confirmation_failed");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Xác thực không thành công",
    );
  });
});

test.describe("Accessibility & Interactions", () => {
  test("internal links are keyboard reachable and focus is visible", async ({ page }) => {
    await page.goto("/");

    await page.keyboard.press("Tab");

    const focusedOutline = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return "";
      const style = window.getComputedStyle(el);
      return style.outlineStyle !== "none" || style.boxShadow !== "none" ? "visible" : "none";
    });

    expect(focusedOutline).toBe("visible");
  });
});
