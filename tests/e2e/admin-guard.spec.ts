import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, type Page, test } from "@playwright/test";

import { requireLocalEndpoint } from "./support/local-endpoints";

const TEST_PASSWORD = "TestPassword123!";
const EMAIL_DOMAIN = "test.capystudy.dev";

const supabaseUrl = requireLocalEndpoint(
  "NEXT_PUBLIC_SUPABASE_URL",
  process.env.NEXT_PUBLIC_SUPABASE_URL,
);
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function uniqueEmail(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@${EMAIL_DOMAIN}`;
}

function serviceRoleClient(): SupabaseClient {
  if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for admin E2E");
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function createConfirmedUser(client: SupabaseClient, email: string): Promise<string> {
  const { data, error } = await client.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error("user creation failed");
  return data.user.id;
}

async function grantRole(
  client: SupabaseClient,
  userId: string,
  role: "owner" | "content_admin" | "support" | "analyst",
): Promise<void> {
  const { error } = await client
    .from("user_roles")
    .insert({ user_id: userId, role, created_by: userId });
  if (error) throw error;
}

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.locator("#password").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: /đăng nhập/i }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test.describe("Admin authorization boundaries", () => {
  test.describe.configure({ mode: "serial" });

  test("non-admin authenticated user is redirected away from /admin", async ({ page }) => {
    const email = uniqueEmail("admin_nonadmin");
    await createConfirmedUser(serviceRoleClient(), email);

    await signIn(page, email);
    await page.goto("/admin");
    await page.waitForURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tổng quan");
  });

  test("owner can access /admin and sees the audit section", async ({ page }) => {
    const email = uniqueEmail("admin_owner");
    const client = serviceRoleClient();
    const userId = await createConfirmedUser(client, email);
    await grantRole(client, userId, "owner");

    await signIn(page, email);
    await page.goto("/admin");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Khu vực quản trị");
    await expect(page.getByRole("heading", { name: "Nhật ký kiểm toán gần đây" })).toBeVisible();
  });

  test("analyst can access /admin and /admin/audit (audit.read)", async ({ page }) => {
    const email = uniqueEmail("admin_analyst");
    const client = serviceRoleClient();
    const userId = await createConfirmedUser(client, email);
    await grantRole(client, userId, "analyst");

    await signIn(page, email);
    await page.goto("/admin");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Khu vực quản trị");
    await expect(page.getByText("analyst", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Nhật ký kiểm toán gần đây" })).toBeVisible();
    await page.goto("/admin/audit");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Nhật ký kiểm toán");
  });

  test("support has no audit.read so /admin/audit is denied", async ({ page }) => {
    const email = uniqueEmail("admin_support");
    const client = serviceRoleClient();
    const userId = await createConfirmedUser(client, email);
    await grantRole(client, userId, "support");

    await signIn(page, email);
    await page.goto("/admin");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Khu vực quản trị");
    await expect(page.getByText("support", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Nhật ký kiểm toán gần đây" })).toHaveCount(0);

    await page.goto("/admin/audit");
    await page.waitForURL(/\/admin$/);
  });

  test("content_admin can access /admin but has no audit.read", async ({ page }) => {
    const email = uniqueEmail("admin_content");
    const client = serviceRoleClient();
    const userId = await createConfirmedUser(client, email);
    await grantRole(client, userId, "content_admin");

    await signIn(page, email);
    await page.goto("/admin");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Khu vực quản trị");
    await expect(page.getByText("content_admin", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Nhật ký kiểm toán gần đây" })).toHaveCount(0);

    await page.goto("/admin/audit");
    await page.waitForURL(/\/admin$/);
  });

  test("revoked role loses access to /admin", async ({ page }) => {
    const email = uniqueEmail("admin_revoked");
    const client = serviceRoleClient();
    const userId = await createConfirmedUser(client, email);
    await grantRole(client, userId, "analyst");

    await signIn(page, email);
    await page.goto("/admin");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Khu vực quản trị");

    await client
      .from("user_roles")
      .update({ revoked_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("role", "analyst")
      .is("revoked_at", null);

    await page.reload();
    await page.waitForURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tổng quan");
  });

  test("direct URL invocation to /admin/audit is blocked for a non-admin", async ({ page }) => {
    const email = uniqueEmail("admin_direct");
    await createConfirmedUser(serviceRoleClient(), email);

    await signIn(page, email);
    await page.goto("/admin/audit");
    await page.waitForURL(/\/dashboard$/);
  });
});
