"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";

import {
  adjustUserUsageSchema,
  overrideUserEntitlementSchema,
  removeUserEntitlementOverrideSchema,
} from "@/features/admin/schemas/user-admin-schema";
import {
  AdminAuthorizationError,
  getCurrentAdminRoles,
  requireAdminPermission,
} from "@/features/admin/server/authorization";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFeatureFlags } from "@/lib/telemetry/feature-flags";

export type ActionResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string; message: string; validationErrors?: Record<string, string[]> };

function ensureUserMutationsEnabled(): void {
  if (!getFeatureFlags().adminUserMutationsEnabled) {
    throw new Error("MUTATIONS_DISABLED: User mutations are disabled on this environment.");
  }
}

async function requireOwnerRole(): Promise<{ userId: string }> {
  const identity = await requireAdminPermission("usage.adjust");
  const roles = await getCurrentAdminRoles();
  if (!roles.includes("owner")) {
    throw new AdminAuthorizationError(
      "Chỉ có tài khoản Owner mới có quyền thực hiện thao tác này.",
    );
  }
  return identity;
}

function extractErrorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    if ("message" in error && typeof (error as { message: unknown }).message === "string") {
      return (error as { message: string }).message;
    }
    if ("error" in error && typeof (error as { error: unknown }).error === "string") {
      return (error as { error: string }).error;
    }
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return String(error);
}

function handleUserActionError(error: unknown): ActionResult<never> {
  if (error instanceof AdminAuthorizationError) {
    return {
      success: false,
      error: "PERMISSION_DENIED",
      message: error.message,
    };
  }

  const message = extractErrorMessage(error);

  if (message.includes("MUTATIONS_DISABLED")) {
    return {
      success: false,
      error: "MUTATIONS_DISABLED",
      message: "Tính năng chỉnh sửa tài khoản người dùng đang bị vô hiệu hóa trên môi trường này.",
    };
  }

  if (message.includes("P0004") || message.includes("modified by another admin")) {
    return {
      success: false,
      error: "STALE_DATA",
      message: "Cấu hình đã được cập nhật bởi một quản trị viên khác. Vui lòng tải lại trang.",
    };
  }

  if (message.includes("P0005") || message.includes("idempotency conflict")) {
    return {
      success: false,
      error: "IDEMPOTENCY_CONFLICT",
      message: "Yêu cầu bị trùng lặp với nội dung khác nhau. Vui lòng thử lại.",
    };
  }

  if (
    message.includes("admin cannot adjust own") ||
    message.includes("admin cannot override own") ||
    message.includes("admin cannot remove own")
  ) {
    return {
      success: false,
      error: "SELF_TARGET_DENIED",
      message: "Quản trị viên không thể tự điều chỉnh quyền lợi hoặc mức sử dụng của chính mình.",
    };
  }

  if (message.includes("owner role required")) {
    return {
      success: false,
      error: "OWNER_ROLE_REQUIRED",
      message: "Chỉ có tài khoản Owner mới có quyền thực hiện thao tác này.",
    };
  }

  if (
    message.includes("P0002") ||
    message.includes("target user not found") ||
    message.includes("override record not found")
  ) {
    return {
      success: false,
      error: "NOT_FOUND",
      message: "Không tìm thấy người dùng hoặc bản ghi cấu hình tương ứng.",
    };
  }

  if (message.includes("unknown entitlement key")) {
    return {
      success: false,
      error: "UNKNOWN_KEY",
      message: "Khóa quyền lợi không hợp lệ hoặc không tồn tại.",
    };
  }

  if (message.includes("type mismatch")) {
    return {
      success: false,
      error: "TYPE_MISMATCH",
      message: "Kiểu dữ liệu không khớp với cấu hình quyền lợi.",
    };
  }

  return {
    success: false,
    error: "UNKNOWN_ERROR",
    message: `Đã xảy ra lỗi: ${message}`,
  };
}

export async function adjustUserUsageAction(
  input: unknown,
): Promise<
  ActionResult<{ usage_key: string; amount: number; new_consumed: number; limit: number }>
> {
  try {
    ensureUserMutationsEnabled();
    const actor = await requireOwnerRole();

    const parsed = adjustUserUsageSchema.safeParse(input);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join(".");
        fieldErrors[path] = fieldErrors[path] ?? [];
        fieldErrors[path].push(issue.message);
      }
      return {
        success: false,
        error: "VALIDATION_ERROR",
        message: "Dữ liệu điều chỉnh sử dụng không hợp lệ.",
        validationErrors: fieldErrors,
      };
    }

    const { target_user_id, usage_key, amount, reason, mutation_token } = parsed.data;
    const idempotencyKey = mutation_token ?? randomUUID();

    const admin = createAdminClient();
    const { data, error } = await admin.rpc("admin_adjust_user_usage_v2", {
      p_actor_user_id: actor.userId,
      p_target_user_id: target_user_id,
      p_usage_key: usage_key,
      p_amount: amount,
      p_reason: reason,
      p_idempotency_key: idempotencyKey,
    });

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath(`/admin/users/${target_user_id}`);
    revalidatePath("/admin/users");

    return {
      success: true,
      data: data as { usage_key: string; amount: number; new_consumed: number; limit: number },
    };
  } catch (error) {
    return handleUserActionError(error);
  }
}

export async function overrideUserEntitlementAction(input: unknown): Promise<
  ActionResult<{
    entitlement_key: string;
    value_type: string;
    expires_at: string;
    updated_at: string;
  }>
> {
  try {
    ensureUserMutationsEnabled();
    const actor = await requireOwnerRole();

    const parsed = overrideUserEntitlementSchema.safeParse(input);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join(".");
        fieldErrors[path] = fieldErrors[path] ?? [];
        fieldErrors[path].push(issue.message);
      }
      return {
        success: false,
        error: "VALIDATION_ERROR",
        message: "Dữ liệu cấu hình quyền lợi không hợp lệ.",
        validationErrors: fieldErrors,
      };
    }

    const {
      target_user_id,
      entitlement_key,
      value_type,
      integer_value,
      boolean_value,
      text_value,
      expires_at,
      expected_updated_at,
      reason,
      mutation_token,
    } = parsed.data;

    const idempotencyKey = mutation_token ?? randomUUID();

    const admin = createAdminClient();
    const { data, error } = await admin.rpc("admin_override_user_entitlement_v2", {
      p_actor_user_id: actor.userId,
      p_target_user_id: target_user_id,
      p_entitlement_key: entitlement_key,
      p_value_type: value_type,
      p_reason: reason,
      p_integer_value: integer_value ?? undefined,
      p_boolean_value: boolean_value ?? undefined,
      p_text_value: text_value ?? undefined,
      p_expires_at: expires_at,
      p_expected_updated_at: expected_updated_at ?? undefined,
      p_idempotency_key: idempotencyKey,
    });

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath(`/admin/users/${target_user_id}`);
    revalidatePath("/admin/users");

    return {
      success: true,
      data: data as {
        entitlement_key: string;
        value_type: string;
        expires_at: string;
        updated_at: string;
      },
    };
  } catch (error) {
    return handleUserActionError(error);
  }
}

export async function removeUserEntitlementOverrideAction(
  input: unknown,
): Promise<ActionResult<{ entitlement_key: string; restored_effective_entitlement: unknown }>> {
  try {
    ensureUserMutationsEnabled();
    const actor = await requireOwnerRole();

    const parsed = removeUserEntitlementOverrideSchema.safeParse(input);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join(".");
        fieldErrors[path] = fieldErrors[path] ?? [];
        fieldErrors[path].push(issue.message);
      }
      return {
        success: false,
        error: "VALIDATION_ERROR",
        message: "Dữ liệu gỡ bỏ quyền lợi không hợp lệ.",
        validationErrors: fieldErrors,
      };
    }

    const { target_user_id, entitlement_key, expected_updated_at, reason, mutation_token } =
      parsed.data;
    const idempotencyKey = mutation_token ?? randomUUID();

    const admin = createAdminClient();
    const { data, error } = await admin.rpc("admin_remove_user_entitlement_override_v2", {
      p_actor_user_id: actor.userId,
      p_target_user_id: target_user_id,
      p_entitlement_key: entitlement_key,
      p_expected_updated_at: expected_updated_at ?? undefined,
      p_reason: reason,
      p_idempotency_key: idempotencyKey,
    });

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath(`/admin/users/${target_user_id}`);
    revalidatePath("/admin/users");

    return {
      success: true,
      data: data as { entitlement_key: string; restored_effective_entitlement: unknown },
    };
  } catch (error) {
    return handleUserActionError(error);
  }
}
