"use server";

import { revalidatePath } from "next/cache";

import {
  catalogLifecycleActionSchema,
  createCatalogSetSchema,
  replaceCatalogCardsSchema,
  swapStarterSetSchema,
  updateCatalogMetadataSchema,
} from "@/features/admin/schemas/catalog-schema";
import {
  AdminAuthorizationError,
  requireAdminPermission,
} from "@/features/admin/server/authorization";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFeatureFlags } from "@/lib/telemetry/feature-flags";

export type ActionResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string; message: string; validationErrors?: Record<string, string[]> };

function ensureMutationsEnabled(): void {
  if (!getFeatureFlags().adminCatalogMutationsEnabled) {
    throw new Error("MUTATIONS_DISABLED: Catalog mutations are disabled on this environment.");
  }
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

function handleActionError(error: unknown): ActionResult<never> {
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
      message: "Tính năng chỉnh sửa Catalog đang bị vô hiệu hóa trên môi trường này.",
    };
  }

  if (message.includes("P0004") || message.includes("modified by another admin")) {
    return {
      success: false,
      error: "STALE_DATA",
      message:
        "Bộ thẻ đã được cập nhật bởi một quản trị viên khác. Vui lòng làm mới trang trước khi lưu.",
    };
  }

  if (
    message.includes("23505") ||
    message.includes("duplicate key") ||
    message.includes("already exists")
  ) {
    return {
      success: false,
      error: "DUPLICATE_SLUG",
      message: "Slug này đã tồn tại trong hệ thống. Vui lòng chọn slug khác.",
    };
  }

  if (message.includes("cannot change slug of a set that has already been published")) {
    return {
      success: false,
      error: "SLUG_LOCKED",
      message: "Không thể đổi slug của bộ thẻ đã từng được xuất bản.",
    };
  }

  if (message.includes("cannot publish catalog set with 0 cards") || message.includes("0 cards")) {
    return {
      success: false,
      error: "ZERO_CARDS",
      message: "Không thể xuất bản bộ thẻ có 0 thẻ. Vui lòng thêm ít nhất 1 thẻ.",
    };
  }

  return {
    success: false,
    error: "SERVER_ERROR",
    message: message.replace(/^.*?:\s*/, ""),
  };
}

export async function createCatalogSetAction(
  rawInput: unknown,
): Promise<ActionResult<{ id: string; slug: string }>> {
  try {
    ensureMutationsEnabled();
    const identity = await requireAdminPermission("catalog.write");
    const parsed = createCatalogSetSchema.safeParse(rawInput);

    if (!parsed.success) {
      return {
        success: false,
        error: "VALIDATION_ERROR",
        message: "Dữ liệu tạo bộ catalog không hợp lệ.",
        validationErrors: parsed.error.flatten().fieldErrors,
      };
    }

    const { data, error } = await createAdminClient().rpc("admin_create_catalog_set", {
      p_actor_user_id: identity.userId,
      p_category_id: parsed.data.category_id,
      p_slug: parsed.data.slug,
      p_title: parsed.data.title,
      p_description: parsed.data.description ?? undefined,
      p_language_front: parsed.data.language_front,
      p_language_back: parsed.data.language_back,
      p_level: parsed.data.level ?? undefined,
      p_tags: parsed.data.tags,
    });

    if (error) {
      throw error;
    }

    const result = data?.[0];
    if (!result?.out_id) {
      throw new Error("Tạo bộ catalog thất bại: không nhận được ID.");
    }

    revalidatePath("/admin/catalog");

    return {
      success: true,
      data: {
        id: result.out_id,
        slug: result.out_slug,
      },
    };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function updateCatalogMetadataAction(
  rawInput: unknown,
): Promise<ActionResult<{ id: string; title: string; updatedAt: string }>> {
  try {
    ensureMutationsEnabled();
    const identity = await requireAdminPermission("catalog.write");
    const parsed = updateCatalogMetadataSchema.safeParse(rawInput);

    if (!parsed.success) {
      return {
        success: false,
        error: "VALIDATION_ERROR",
        message: "Dữ liệu cập nhật metadata không hợp lệ.",
        validationErrors: parsed.error.flatten().fieldErrors,
      };
    }

    const { data, error } = await createAdminClient().rpc("admin_update_catalog_set", {
      p_actor_user_id: identity.userId,
      p_catalog_set_id: parsed.data.catalog_set_id,
      p_expected_updated_at: parsed.data.expected_updated_at,
      p_title: parsed.data.title,
      p_description: parsed.data.description ?? undefined,
      p_category_id: parsed.data.category_id ?? undefined,
      p_language_front: parsed.data.language_front ?? undefined,
      p_language_back: parsed.data.language_back ?? undefined,
      p_level: parsed.data.level ?? undefined,
      p_tags: parsed.data.tags ?? undefined,
      p_slug: parsed.data.slug ?? undefined,
    });

    if (error) {
      throw error;
    }

    const result = data?.[0];
    if (!result?.out_id) {
      throw new Error("Cập nhật metadata thất bại.");
    }

    revalidatePath("/admin/catalog");
    revalidatePath(`/admin/catalog/${parsed.data.catalog_set_id}`);

    return {
      success: true,
      data: {
        id: result.out_id,
        title: result.out_title,
        updatedAt: result.out_updated_at,
      },
    };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function replaceCatalogCardsAction(
  rawInput: unknown,
): Promise<ActionResult<{ cardCount: number; updatedAt: string }>> {
  try {
    ensureMutationsEnabled();
    const identity = await requireAdminPermission("catalog.write");
    const parsed = replaceCatalogCardsSchema.safeParse(rawInput);

    if (!parsed.success) {
      return {
        success: false,
        error: "VALIDATION_ERROR",
        message: "Dữ liệu thẻ không hợp lệ.",
        validationErrors: parsed.error.flatten().fieldErrors,
      };
    }

    const { data, error } = await createAdminClient().rpc("admin_replace_catalog_cards", {
      p_actor_user_id: identity.userId,
      p_catalog_set_id: parsed.data.catalog_set_id,
      p_expected_updated_at: parsed.data.expected_updated_at,
      p_cards: parsed.data.cards,
      p_reason: parsed.data.reason,
    });

    if (error) {
      throw error;
    }

    const result = data?.[0];

    revalidatePath("/admin/catalog");
    revalidatePath(`/admin/catalog/${parsed.data.catalog_set_id}`);

    return {
      success: true,
      data: {
        cardCount: result?.out_card_count ?? parsed.data.cards.length,
        updatedAt: result?.out_updated_at ?? new Date().toISOString(),
      },
    };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function publishCatalogSetAction(
  rawInput: unknown,
): Promise<ActionResult<{ id: string; version: number; publishedAt: string }>> {
  try {
    ensureMutationsEnabled();
    const identity = await requireAdminPermission("catalog.publish");
    const parsed = catalogLifecycleActionSchema.safeParse(rawInput);

    if (!parsed.success) {
      return {
        success: false,
        error: "VALIDATION_ERROR",
        message: "Dữ liệu xuất bản không hợp lệ.",
        validationErrors: parsed.error.flatten().fieldErrors,
      };
    }

    const { data, error } = await createAdminClient().rpc("admin_publish_catalog_set", {
      p_actor_user_id: identity.userId,
      p_catalog_set_id: parsed.data.catalog_set_id,
      p_expected_updated_at: parsed.data.expected_updated_at,
      p_reason: parsed.data.reason,
    });

    if (error) {
      throw error;
    }

    const result = data?.[0];
    if (!result?.out_id) {
      throw new Error("Xuất bản bộ thẻ thất bại.");
    }

    revalidatePath("/admin/catalog");
    revalidatePath(`/admin/catalog/${parsed.data.catalog_set_id}`);
    revalidatePath("/sets/catalog");

    return {
      success: true,
      data: {
        id: result.out_id,
        version: result.out_version,
        publishedAt: result.out_published_at,
      },
    };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function unpublishCatalogSetAction(
  rawInput: unknown,
): Promise<ActionResult<{ id: string; version: number }>> {
  try {
    ensureMutationsEnabled();
    const identity = await requireAdminPermission("catalog.publish");
    const parsed = catalogLifecycleActionSchema.safeParse(rawInput);

    if (!parsed.success) {
      return {
        success: false,
        error: "VALIDATION_ERROR",
        message: "Dữ liệu gỡ xuất bản không hợp lệ.",
        validationErrors: parsed.error.flatten().fieldErrors,
      };
    }

    const { data, error } = await createAdminClient().rpc("admin_unpublish_catalog_set", {
      p_actor_user_id: identity.userId,
      p_catalog_set_id: parsed.data.catalog_set_id,
      p_expected_updated_at: parsed.data.expected_updated_at,
      p_reason: parsed.data.reason,
    });

    if (error) {
      throw error;
    }

    const result = data?.[0];
    if (!result?.out_id) {
      throw new Error("Gỡ xuất bản bộ thẻ thất bại.");
    }

    revalidatePath("/admin/catalog");
    revalidatePath(`/admin/catalog/${parsed.data.catalog_set_id}`);
    revalidatePath("/sets/catalog");

    return {
      success: true,
      data: {
        id: result.out_id,
        version: result.out_version,
      },
    };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function archiveCatalogSetAction(
  rawInput: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    ensureMutationsEnabled();
    const identity = await requireAdminPermission("catalog.publish");
    const parsed = catalogLifecycleActionSchema.safeParse(rawInput);

    if (!parsed.success) {
      return {
        success: false,
        error: "VALIDATION_ERROR",
        message: "Dữ liệu lưu trữ không hợp lệ.",
        validationErrors: parsed.error.flatten().fieldErrors,
      };
    }

    const { data, error } = await createAdminClient().rpc("admin_archive_catalog_set", {
      p_actor_user_id: identity.userId,
      p_catalog_set_id: parsed.data.catalog_set_id,
      p_expected_updated_at: parsed.data.expected_updated_at,
      p_reason: parsed.data.reason,
    });

    if (error) {
      throw error;
    }

    const result = data?.[0];
    if (!result?.out_id) {
      throw new Error("Lưu trữ bộ thẻ thất bại.");
    }

    revalidatePath("/admin/catalog");
    revalidatePath(`/admin/catalog/${parsed.data.catalog_set_id}`);
    revalidatePath("/sets/catalog");

    return {
      success: true,
      data: {
        id: result.out_id,
      },
    };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function restoreCatalogSetAction(
  rawInput: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    ensureMutationsEnabled();
    const identity = await requireAdminPermission("catalog.publish");
    const parsed = catalogLifecycleActionSchema.safeParse(rawInput);

    if (!parsed.success) {
      return {
        success: false,
        error: "VALIDATION_ERROR",
        message: "Dữ liệu khôi phục không hợp lệ.",
        validationErrors: parsed.error.flatten().fieldErrors,
      };
    }

    const { data, error } = await createAdminClient().rpc("admin_restore_catalog_set", {
      p_actor_user_id: identity.userId,
      p_catalog_set_id: parsed.data.catalog_set_id,
      p_expected_updated_at: parsed.data.expected_updated_at,
      p_reason: parsed.data.reason,
    });

    if (error) {
      throw error;
    }

    const result = data?.[0];
    if (!result?.out_id) {
      throw new Error("Khôi phục bộ thẻ thất bại.");
    }

    revalidatePath("/admin/catalog");
    revalidatePath(`/admin/catalog/${parsed.data.catalog_set_id}`);

    return {
      success: true,
      data: {
        id: result.out_id,
      },
    };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function swapStarterSetAction(
  rawInput: unknown,
): Promise<
  ActionResult<{ oldId: string; newId: string; starterOrder: number; newVersion: number }>
> {
  try {
    ensureMutationsEnabled();
    // Dual capability requirement
    const identity = await requireAdminPermission("catalog.write");
    await requireAdminPermission("catalog.publish");

    const parsed = swapStarterSetSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: "VALIDATION_ERROR",
        message: "Dữ liệu thay thế starter không hợp lệ.",
        validationErrors: parsed.error.flatten().fieldErrors,
      };
    }

    const { data, error } = await createAdminClient().rpc("admin_swap_starter_set", {
      p_actor_user_id: identity.userId,
      p_old_starter_set_id: parsed.data.old_starter_set_id,
      p_new_draft_set_id: parsed.data.new_draft_set_id,
      p_expected_updated_at_old: parsed.data.expected_updated_at_old,
      p_expected_updated_at_new: parsed.data.expected_updated_at_new,
      p_reason: parsed.data.reason,
    });

    if (error) {
      throw error;
    }

    const result = data?.[0];
    if (!result?.out_new_id) {
      throw new Error("Thay thế bộ starter thất bại.");
    }

    revalidatePath("/admin/catalog");
    revalidatePath(`/admin/catalog/${parsed.data.old_starter_set_id}`);
    revalidatePath(`/admin/catalog/${parsed.data.new_draft_set_id}`);
    revalidatePath("/sets/catalog");

    return {
      success: true,
      data: {
        oldId: result.out_old_id,
        newId: result.out_new_id,
        starterOrder: result.out_starter_order,
        newVersion: result.out_new_version,
      },
    };
  } catch (error) {
    return handleActionError(error);
  }
}
