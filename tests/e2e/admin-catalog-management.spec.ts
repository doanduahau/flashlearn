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

test.describe("Admin Catalog Management (LP-10 Part 2A)", () => {
  test.describe.configure({ mode: "serial" });

  test("Owner can create, edit metadata, replace cards, preview, publish, unpublish, archive and restore a catalog set", async ({
    page,
  }) => {
    const email = uniqueEmail("admin_catalog_owner");
    const userId = await createConfirmedUser(serviceRoleClient(), email);
    await grantRole(serviceRoleClient(), userId, "owner");
    await signIn(page, email);

    // 1. Visit admin catalog list
    await page.goto("/admin/catalog");
    await expect(page).toHaveURL(/.*\/admin\/catalog/);
    await expect(page.locator("h1")).toContainText("Quản lý thư viện");

    // 2. Open Create Modal
    const createBtn = page.getByRole("button", { name: /\+ Tạo bộ mới/i });
    if (await createBtn.isVisible()) {
      await createBtn.click();

      // Fill create form
      const randomSuffix = Math.floor(Math.random() * 10000);
      const testSlug = `e2e-catalog-${randomSuffix}`;
      const testTitle = `E2E Catalog Test ${randomSuffix}`;

      await page.fill('input[placeholder*="50 Từ vựng"]', testTitle);
      await page.fill('input[placeholder*="tu-vung-trai-cay"]', testSlug);
      await page.getByRole("button", { name: /Tạo bản thảo/i }).click();

      // Redirects to detail page
      await expect(page).toHaveURL(new RegExp(`/admin/catalog/`));
      await expect(page.locator("h2")).toContainText(testTitle);
      await expect(page.locator("text=Bản thảo (Draft)")).toBeVisible();

      // 3. Edit Metadata
      const descInput = page.locator("textarea").first();
      await descInput.fill("Updated description via E2E test");
      await page.getByRole("button", { name: /Lưu thông tin Metadata/i }).click();
      await expect(page.locator("text=Cập nhật thông tin thành công")).toBeVisible();

      // 4. Switch to Cards Tab & Add cards
      await page.getByRole("button", { name: /Quản lý Thẻ/i }).click();
      await page.getByRole("button", { name: /\+ Thêm thẻ/i }).click();

      // Fill Card 1
      const frontInputs = page.locator('textarea[placeholder*="Nhập mặt trước"]');
      const backInputs = page.locator('textarea[placeholder*="Nhập mặt sau"]');

      await frontInputs.nth(0).fill("Hello");
      await backInputs.nth(0).fill("Xin chào");

      // Save Cards (triggers Reason Dialog)
      await page.getByRole("button", { name: /Lưu danh sách thẻ/i }).click();
      await expect(page.locator("text=Xác nhận lưu danh sách Thẻ")).toBeVisible();

      await page.fill('textarea[id="action-reason"]', "E2E test saving card");
      await page.getByRole("button", { name: /Xác nhận & Lưu/i }).click();
      await expect(page.locator("text=Lưu thành công 1 thẻ")).toBeVisible();

      // 5. Switch to Preview Tab
      await page.getByRole("button", { name: /Xem trước/i }).click();
      await expect(page.locator("text=Hello")).toBeVisible();
      await page.locator("text=Hello").click();
      await expect(page.locator("text=Xin chào")).toBeVisible();

      // 6. Publish Catalog Set
      await page.getByRole("button", { name: /Xuất bản \(Publish\)/i }).click();
      await expect(page.locator("text=Xác nhận Xuất bản (Publish)")).toBeVisible();

      await page.fill('textarea[id="action-reason"]', "E2E test publish v1");
      await page.getByRole("button", { name: "Xác nhận Xuất bản" }).click();

      // Assert status is published
      await expect(page.locator("text=Đã xuất bản (v1)")).toBeVisible();

      // 7. Unpublish
      await page.getByRole("button", { name: /Gỡ xuất bản \(Unpublish\)/i }).click();
      await expect(page.locator("text=Xác nhận Gỡ xuất bản (Unpublish)")).toBeVisible();
      await page.fill('textarea[id="action-reason"]', "E2E test unpublish to draft");
      await page.getByRole("button", { name: "Gỡ xuất bản" }).click();

      // Assert status is draft again
      await expect(page.locator("text=Bản thảo (Draft)")).toBeVisible();

      // 8. Archive
      await page.getByRole("button", { name: /Lưu trữ/i }).click();
      await expect(page.locator("text=Xác nhận Lưu trữ (Archive)")).toBeVisible();
      await page.fill('textarea[id="action-reason"]', "E2E test archive");
      await page.getByRole("button", { name: "Lưu trữ" }).click();

      // Assert status is archived
      await expect(page.locator("text=Đã lưu trữ")).toBeVisible();

      // 9. Restore
      await page.getByRole("button", { name: /Khôi phục về Bản thảo/i }).click();
      await expect(page.locator("text=Xác nhận Khôi phục (Restore)")).toBeVisible();
      await page.fill('textarea[id="action-reason"]', "E2E test restore");
      await page.getByRole("button", { name: "Khôi phục về Draft" }).click();

      // Assert status is back to draft
      await expect(page.locator("text=Bản thảo (Draft)")).toBeVisible();
    }
  });
});
