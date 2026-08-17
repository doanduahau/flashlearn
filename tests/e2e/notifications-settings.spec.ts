import { expect, test } from "@playwright/test";

import { signUpAndConfirm, uniqueEmail } from "./support/auth-helpers";

test.describe("Notification settings E2E", () => {
  test("User configures push notification preferences", async ({ browser }) => {
    const context = await browser.newContext();

    if (typeof context.grantPermissions === "function") {
      await context.grantPermissions(["notifications"]);
    }

    const page = await context.newPage();

    page.on("console", (msg) => console.log("[BROWSER CONSOLE]", msg.type(), msg.text()));
    page.on("pageerror", (err) => console.log("[BROWSER ERROR]", err));

    await page.addInitScript(() => {
      Object.defineProperty(window, "Notification", {
        writable: true,
        configurable: true,
        value: {
          permission: "granted",
          requestPermission: async () => "granted",
        },
      });

      Object.defineProperty(window, "PushManager", {
        writable: true,
        configurable: true,
        value: class MockPushManager {},
      });

      if ("serviceWorker" in navigator && navigator.serviceWorker) {
        const mockRegistration = {
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => true,
          unregister: async () => true,
          update: async () => {},
          active: null,
          installing: null,
          waiting: null,
          scope: "/",
          pushManager: {
            getSubscription: async () => null,
            subscribe: async () => ({
              toJSON: () => ({
                endpoint: "https://push.example.com/e2e-subscription",
                keys: { p256dh: "e2e-p256dh", auth: "e2e-auth" },
              }),
            }),
          },
        };

        navigator.serviceWorker.getRegistration = async () =>
          mockRegistration as unknown as ServiceWorkerRegistration;
        navigator.serviceWorker.register = async () =>
          mockRegistration as unknown as ServiceWorkerRegistration;
      }
    });

    const email = uniqueEmail("notify_user");
    await signUpAndConfirm(page, email);

    await page.goto("/profile?tab=settings");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Cá nhân");

    // Section heading is visible
    await expect(page.getByRole("heading", { level: 2, name: "Cài đặt Nhắc nhở" })).toBeVisible();

    const masterSwitch = page.getByRole("switch");
    await expect(masterSwitch).not.toBeChecked();

    // Turn master toggle ON
    await masterSwitch.click();
    await expect(masterSwitch).toBeChecked({ timeout: 15_000 });

    // Time inputs are enabled
    const streakInput = page.getByLabel("Giờ nhắc giữ streak");
    const reviewInput = page.getByLabel("Giờ nhắc ôn tập");

    await expect(streakInput).toBeEnabled({ timeout: 15_000 });
    await expect(reviewInput).toBeEnabled({ timeout: 15_000 });

    // Change times
    await streakInput.fill("20:30");
    await reviewInput.fill("09:15");

    // Reload page to verify persistence
    await page.reload();
    await expect(page.getByRole("switch")).toBeChecked();
    await expect(page.getByLabel("Giờ nhắc giữ streak")).toHaveValue("20:30");
    await expect(page.getByLabel("Giờ nhắc ôn tập")).toHaveValue("09:15");

    // Turn master toggle OFF
    await page.getByRole("switch").click();
    await expect(page.getByRole("switch")).not.toBeChecked();

    await page.reload();
    await expect(page.getByRole("switch")).not.toBeChecked();

    await context.close();
  });
});
