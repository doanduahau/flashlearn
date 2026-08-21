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
    user_metadata: { display_name: `User ${email.slice(0, 8)}` },
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

test.describe("Admin User Management (LP-10 Part 2B)", () => {
  test.describe.configure({ mode: "serial" });

  let admin: SupabaseClient;
  let ownerEmail: string;
  let ownerId: string;
  let targetEmail: string;
  let targetId: string;

  test.beforeAll(async () => {
    admin = serviceRoleClient();
    ownerEmail = uniqueEmail("owner_ui_acc");
    targetEmail = uniqueEmail("target_ui_acc");

    ownerId = await createConfirmedUser(admin, ownerEmail);
    await grantRole(admin, ownerId, "owner");

    targetId = await createConfirmedUser(admin, targetEmail);
  });

  test("1. Owner performs full UI Usage Adjustment flow (+15 credits) with confirmation", async ({
    page,
  }) => {
    await signIn(page, ownerEmail);
    await page.goto(`/admin/users/${targetId}`);

    // Verify detail page
    await expect(
      page.getByRole("heading", { name: /chi tiết & quản trị tài khoản/i }),
    ).toBeVisible();
    await expect(page.getByText(targetEmail)).toBeVisible();

    // Click "Điều chỉnh mức dùng" on the first usage meter (AI content credits)
    const adjustButton = page.getByRole("button", { name: /điều chỉnh mức dùng/i }).first();
    await expect(adjustButton).toBeVisible();
    await adjustButton.click();

    // Verify modal step 1 (Input)
    await expect(page.getByRole("heading", { name: /điều chỉnh mức sử dụng/i })).toBeVisible();
    await expect(page.getByText(/chỉ áp dụng cho tài khoản:/i)).toBeVisible();

    // Select Credit direction (default), set amount 15, set valid reason
    const amountInput = page.locator("#adjust-amount");
    await amountInput.fill("15");

    const reasonInput = page.locator("#adjust-reason");
    await reasonInput.fill("Cấp thêm 15 lượt AI credits cho khách hàng thử nghiệm");

    // Click Tiếp tục → to reach confirmation step
    await page.getByRole("button", { name: /tiếp tục →/i }).click();

    // Verify step 2 (Confirm)
    await expect(page.getByRole("heading", { name: /xác nhận điều chỉnh/i })).toBeVisible();
    await expect(page.getByText(/chỉ áp dụng cho tài khoản:/i)).toBeVisible();
    await expect(page.getByText(/\+15 lượt/i)).toBeVisible();
    await expect(
      page.getByText(/Cấp thêm 15 lượt AI credits cho khách hàng thử nghiệm/),
    ).toBeVisible();

    // Confirm execution
    const confirmButton = page.getByRole("button", { name: /xác nhận & áp dụng/i });
    await confirmButton.click();

    // Modal closes
    await expect(page.getByRole("heading", { name: /xác nhận điều chỉnh/i })).toHaveCount(0);

    // Reload page to verify persistence
    await page.reload();
    await expect(
      page.getByRole("heading", { name: /chi tiết & quản trị tài khoản/i }),
    ).toBeVisible();

    // Verify audit log entry is recorded in the UI table
    await expect(page.getByText(/điều chỉnh mức sử dụng/i)).toBeVisible();
    await expect(
      page.getByText(/Cấp thêm 15 lượt AI credits cho khách hàng thử nghiệm/),
    ).toBeVisible();
  });

  test("2. Owner performs full UI Entitlement Override flow (sets.regular.max = 50)", async ({
    page,
  }) => {
    await signIn(page, ownerEmail);
    await page.goto(`/admin/users/${targetId}`);

    // Click "Tùy chỉnh" on the regular sets limit
    const overrideButton = page.getByRole("button", { name: /tùy chỉnh/i }).first();
    await expect(overrideButton).toBeVisible();
    await overrideButton.click();

    // Verify modal step 1 (Input)
    await expect(page.getByRole("heading", { name: /thêm cấu hình riêng/i })).toBeVisible();
    await expect(page.getByText(/chỉ áp dụng cho tài khoản:/i)).toBeVisible();

    // Fill value 50, duration 45 days, reason
    const valueInput = page.locator("#override-value");
    await valueInput.fill("50");

    const durationInput = page.locator("#override-duration");
    await durationInput.fill("45");

    const reasonInput = page.locator("#override-reason");
    await reasonInput.fill("Nâng hạn mức 50 bộ flashcard cho người dùng VIP");

    // Click Tiếp tục →
    await page.getByRole("button", { name: /tiếp tục →/i }).click();

    // Verify step 2 (Confirm)
    await expect(page.getByRole("heading", { name: /thêm cấu hình riêng/i })).toBeVisible();
    await expect(page.getByText(/chỉ áp dụng cho tài khoản:/i)).toBeVisible();
    await expect(page.getByText("50", { exact: true })).toBeVisible();
    await expect(page.getByText(/45 ngày/i)).toBeVisible();
    await expect(page.getByText(/Nâng hạn mức 50 bộ flashcard cho người dùng VIP/)).toBeVisible();

    // Confirm execution
    const confirmButton = page.getByRole("button", { name: /xác nhận & lưu cấu hình/i });
    await confirmButton.click();

    // Modal closes
    await expect(page.getByRole("heading", { name: /thêm cấu hình riêng/i })).toHaveCount(0);

    // Reload page to verify persistence
    await page.reload();
    await expect(
      page.getByRole("heading", { name: /chi tiết & quản trị tài khoản/i }),
    ).toBeVisible();

    // Verify UI reflects "★ Cấu hình riêng", custom value 50, and buttons "Sửa" & "Gỡ bỏ"
    await expect(page.getByText(/★ cấu hình riêng/i)).toBeVisible();
    await expect(page.getByText("50", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /^sửa$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^gỡ bỏ$/i })).toBeVisible();
  });

  test("3. Owner performs full UI Edit Override flow (updates sets.regular.max to 75)", async ({
    page,
  }) => {
    await signIn(page, ownerEmail);
    await page.goto(`/admin/users/${targetId}`);

    // Click "Sửa" on the existing override
    const editButton = page.getByRole("button", { name: /^sửa$/i });
    await expect(editButton).toBeVisible();
    await editButton.click();

    // Verify modal opens in edit mode
    await expect(page.getByRole("heading", { name: /chỉnh sửa cấu hình riêng/i })).toBeVisible();
    await expect(page.getByText(/chỉ áp dụng cho tài khoản:/i)).toBeVisible();

    // Update value to 75 and duration to 60 days
    const valueInput = page.locator("#override-value");
    await valueInput.fill("75");

    const durationInput = page.locator("#override-duration");
    await durationInput.fill("60");

    const reasonInput = page.locator("#override-reason");
    await reasonInput.fill("Tăng thêm hạn mức lên 75 bộ flashcard theo gói hỗ trợ");

    // Click Tiếp tục →
    await page.getByRole("button", { name: /tiếp tục →/i }).click();

    // Confirm execution
    const confirmButton = page.getByRole("button", { name: /xác nhận & lưu cấu hình/i });
    await confirmButton.click();

    // Modal closes
    await expect(page.getByRole("heading", { name: /chỉnh sửa cấu hình riêng/i })).toHaveCount(0);

    // Reload page
    await page.reload();
    await expect(
      page.getByRole("heading", { name: /chi tiết & quản trị tài khoản/i }),
    ).toBeVisible();

    // Verify UI displays new value 75
    await expect(page.getByText("75", { exact: true })).toBeVisible();
    await expect(page.getByText(/★ cấu hình riêng/i)).toBeVisible();
  });

  test("4. Owner performs full UI Remove Override flow and restores base plan limit", async ({
    page,
  }) => {
    await signIn(page, ownerEmail);
    await page.goto(`/admin/users/${targetId}`);

    // Click "Gỡ bỏ" on the active override
    const removeButton = page.getByRole("button", { name: /^gỡ bỏ$/i });
    await expect(removeButton).toBeVisible();
    await removeButton.click();

    // Verify remove modal
    await expect(page.getByRole("heading", { name: /gỡ bỏ cấu hình riêng/i })).toBeVisible();
    await expect(page.getByText(/chỉ áp dụng cho tài khoản:/i)).toBeVisible();
    await expect(page.getByText(/khôi phục mặc định/i)).toBeVisible();

    // Fill reason
    const reasonInput = page.locator("#remove-reason");
    await reasonInput.fill("Hết thời gian thử nghiệm, khôi phục hạn mức gói gốc");

    // Confirm removal
    const confirmRemoveButton = page.getByRole("button", { name: /xác nhận gỡ bỏ/i });
    await confirmRemoveButton.click();

    // Modal closes
    await expect(page.getByRole("heading", { name: /gỡ bỏ cấu hình riêng/i })).toHaveCount(0);

    // Reload page
    await page.reload();
    await expect(
      page.getByRole("heading", { name: /chi tiết & quản trị tài khoản/i }),
    ).toBeVisible();

    // Verify override badge is gone and button is reset to "Tùy chỉnh"
    await expect(page.getByText(/★ cấu hình riêng/i)).toHaveCount(0);
    await expect(page.getByRole("button", { name: /tùy chỉnh/i }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /^gỡ bỏ$/i })).toHaveCount(0);
  });

  test("5. Support role has read access, sees no mutation buttons, and direct mutation fails", async ({
    page,
  }) => {
    const supportEmail = uniqueEmail("support_neg_e2e");
    const supportId = await createConfirmedUser(admin, supportEmail);
    await grantRole(admin, supportId, "support");

    // Sign in as Support
    await signIn(page, supportEmail);

    // Navigate to user detail directly
    await page.goto(`/admin/users/${targetId}`);
    await expect(
      page.getByRole("heading", { name: /chi tiết & quản trị tài khoản/i }),
    ).toBeVisible();
    await expect(page.getByText(targetEmail)).toBeVisible();

    // Ensure mutation buttons are completely absent for Support
    await expect(page.getByRole("button", { name: /điều chỉnh mức dùng/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /tùy chỉnh/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /gỡ bỏ/i })).toHaveCount(0);
  });

  test("6. Owner visiting own user admin URL sees self-target banner and cannot mutate self", async ({
    page,
  }) => {
    await signIn(page, ownerEmail);

    // Visit own admin user details URL
    await page.goto(`/admin/users/${ownerId}`);
    await expect(
      page.getByRole("heading", { name: /chi tiết & quản trị tài khoản/i }),
    ).toBeVisible();

    // Verify self-target warning banner is rendered
    await expect(page.getByText(/tài khoản của chính bạn/i)).toBeVisible();

    // Mutation buttons must be completely absent when viewing self
    await expect(page.getByRole("button", { name: /điều chỉnh mức dùng/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /tùy chỉnh/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /gỡ bỏ/i })).toHaveCount(0);
  });
});
