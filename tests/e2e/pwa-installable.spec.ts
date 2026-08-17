import { expect, test } from "@playwright/test";

test.describe("PWA installable", () => {
  test("manifest is served with the expected installable metadata", async ({ request }) => {
    const response = await request.get("/manifest.webmanifest");
    expect(response.ok()).toBe(true);
    expect(response.headers()["content-type"]).toContain("application/manifest+json");

    const manifest = (await response.json()) as {
      name: string;
      short_name: string;
      start_url: string;
      display: string;
      theme_color: string;
      background_color: string;
      icons: Array<{ src: string; sizes: string; type: string; purpose?: string }>;
    };
    expect(manifest.name).toBe("CapyStudy");
    expect(manifest.short_name).toBe("CapyStudy");
    expect(manifest.start_url).toBe("/");
    expect(manifest.display).toBe("standalone");
    expect(manifest.theme_color).toBe("#ffffff");
    expect(manifest.background_color).toBe("#f8fbf7");
    expect(
      manifest.icons.some((icon) => icon.sizes === "192x192" && icon.type === "image/png"),
    ).toBe(true);
    expect(
      manifest.icons.some((icon) => icon.sizes === "512x512" && icon.type === "image/png"),
    ).toBe(true);
    expect(
      manifest.icons.some(
        (icon) =>
          icon.sizes === "512x512" && icon.purpose === "maskable" && icon.type === "image/png",
      ),
    ).toBe(true);
  });

  test("service worker is registered and served", async ({ page }) => {
    await page.goto("/");
    await page.waitForFunction(() => Boolean(navigator.serviceWorker), null, { timeout: 10_000 });

    const supported = await page.evaluate(() => "serviceWorker" in navigator);
    expect(supported).toBe(true);

    const active = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      return Boolean(registration.active);
    });
    expect(active).toBe(true);
  });

  test("sw.js file is served", async ({ request }) => {
    const response = await request.get("/sw.js");
    expect(response.ok()).toBe(true);
    const body = await response.text();
    expect(body).toContain("serwist");
  });

  test("PWA icons are served with the right content type", async ({ request }) => {
    for (const path of [
      "/icons/icon-192.png",
      "/icons/icon-512.png",
      "/icons/icon-maskable-512.png",
      "/icons/apple-touch-icon.png",
    ]) {
      const response = await request.get(path);
      expect(response.ok(), `${path} should be served`).toBe(true);
      expect(response.headers()["content-type"]).toContain("image/png");
    }
  });

  test("offline page is served", async ({ page }) => {
    await page.goto("/offline");
    await expect(page.getByRole("heading", { name: "Bạn đang offline" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Về trang chủ" })).toBeVisible();
  });
});
