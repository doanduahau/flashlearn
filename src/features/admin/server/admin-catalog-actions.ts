"use server";

import { revalidatePath } from "next/cache";

import {
  AdminAuthorizationError,
  requireAdminPermission,
} from "@/features/admin/server/authorization";
import { createAdminClient } from "@/lib/supabase/admin";

// ============================================================
// Types
// ============================================================

export type CatalogMutationResult =
  { ok: true; id: string; [key: string]: unknown } | { ok: false; error: string };

type AdminMutationError = {
  ok: false;
  error: string;
};

// ============================================================
// Shared helpers
// ============================================================

async function getActor() {
  const identity = await requireAdminPermission("catalog.write");
  return identity.userId;
}

async function requirePublishPermission() {
  const identity = await requireAdminPermission("catalog.publish");
  return identity.userId;
}

function adminError(message: string): AdminMutationError {
  return { ok: false, error: message };
}

// ============================================================
// 1. Update catalog set metadata
// ============================================================

export async function adminUpdateCatalogSet(
  catalogSetId: string,
  updates: {
    title?: string;
    description?: string | null;
    category_id?: string;
    language_front?: string;
    language_back?: string;
    level?: string | null;
    tags?: string[];
    is_starter?: boolean;
  },
): Promise<CatalogMutationResult> {
  try {
    const actorId = await getActor();
    const admin = createAdminClient();

    const { data, error } = await admin.rpc("admin_update_catalog_set", {
      p_actor_user_id: actorId,
      p_catalog_set_id: catalogSetId,
      ...(updates.title !== undefined && { p_title: updates.title }),
      ...(updates.description !== undefined && { p_description: updates.description ?? undefined }),
      ...(updates.category_id !== undefined && { p_category_id: updates.category_id }),
      ...(updates.language_front !== undefined && { p_language_front: updates.language_front }),
      ...(updates.language_back !== undefined && { p_language_back: updates.language_back }),
      ...(updates.level !== undefined && { p_level: updates.level ?? undefined }),
      ...(updates.tags !== undefined && { p_tags: updates.tags }),
      ...(updates.is_starter !== undefined && { p_is_starter: updates.is_starter }),
    });

    if (error) {
      const msg = error.message;
      if (msg.includes("already 3 published starters"))
        return adminError("Đã có 3 bộ starter được xuất bản.");
      if (msg.includes("catalog set not found")) return adminError("Không tìm thấy bộ thư viện.");
      return adminError(`Không thể cập nhật: ${msg}`);
    }

    const row = data?.[0];
    if (!row) return adminError("Không có kết quả từ server.");

    revalidatePath("/admin/catalog");
    revalidatePath(`/admin/catalog/${catalogSetId}`);
    return { ok: true, id: row.id, title: row.title, version: row.version, status: row.status };
  } catch (error) {
    if (error instanceof AdminAuthorizationError)
      return adminError("Không có quyền thực hiện thao tác này.");
    return adminError("Lỗi server khi cập nhật bộ thư viện.");
  }
}

// ============================================================
// 2. Publish catalog set
// ============================================================

export async function adminPublishCatalogSet(
  catalogSetId: string,
  reason: string,
): Promise<CatalogMutationResult> {
  try {
    const actorId = await requirePublishPermission();
    const admin = createAdminClient();

    const { data, error } = await admin.rpc("admin_publish_catalog_set", {
      p_actor_user_id: actorId,
      p_catalog_set_id: catalogSetId,
      p_reason: reason,
    });

    if (error) {
      const msg = error.message;
      if (msg.includes("already published")) return adminError("Bộ thư viện đã được xuất bản.");
      if (msg.includes("catalog set not found")) return adminError("Không tìm thấy bộ thư viện.");
      return adminError(`Không thể xuất bản: ${msg}`);
    }

    const row = data?.[0];
    if (!row) return adminError("Không có kết quả từ server.");

    revalidatePath("/admin/catalog");
    revalidatePath(`/admin/catalog/${catalogSetId}`);
    return {
      ok: true,
      id: row.id,
      version: row.version,
      status: row.status,
      published_at: row.published_at,
    };
  } catch (error) {
    if (error instanceof AdminAuthorizationError) return adminError("Không có quyền xuất bản.");
    return adminError("Lỗi server khi xuất bản.");
  }
}

// ============================================================
// 3. Unpublish catalog set
// ============================================================

export async function adminUnpublishCatalogSet(
  catalogSetId: string,
  reason: string,
): Promise<CatalogMutationResult> {
  try {
    const actorId = await requirePublishPermission();
    const admin = createAdminClient();

    const { data, error } = await admin.rpc("admin_unpublish_catalog_set", {
      p_actor_user_id: actorId,
      p_catalog_set_id: catalogSetId,
      p_reason: reason,
    });

    if (error) {
      const msg = error.message;
      if (msg.includes("not published")) return adminError("Bộ thư viện chưa được xuất bản.");
      if (msg.includes("catalog set not found")) return adminError("Không tìm thấy bộ thư viện.");
      return adminError(`Không thể hủy xuất bản: ${msg}`);
    }

    const row = data?.[0];
    if (!row) return adminError("Không có kết quả từ server.");

    revalidatePath("/admin/catalog");
    revalidatePath(`/admin/catalog/${catalogSetId}`);
    return { ok: true, id: row.id, version: row.version, status: row.status };
  } catch (error) {
    if (error instanceof AdminAuthorizationError) return adminError("Không có quyền hủy xuất bản.");
    return adminError("Lỗi server khi hủy xuất bản.");
  }
}

// ============================================================
// 4. Archive catalog set
// ============================================================

export async function adminArchiveCatalogSet(
  catalogSetId: string,
  reason: string,
): Promise<CatalogMutationResult> {
  try {
    const actorId = await getActor();
    const admin = createAdminClient();

    const { data, error } = await admin.rpc("admin_archive_catalog_set", {
      p_actor_user_id: actorId,
      p_catalog_set_id: catalogSetId,
      p_reason: reason,
    });

    if (error) {
      const msg = error.message;
      if (msg.includes("already archived")) return adminError("Bộ thư viện đã được lưu trữ.");
      if (msg.includes("catalog set not found")) return adminError("Không tìm thấy bộ thư viện.");
      return adminError(`Không thể lưu trữ: ${msg}`);
    }

    const row = data?.[0];
    if (!row) return adminError("Không có kết quả từ server.");

    revalidatePath("/admin/catalog");
    revalidatePath(`/admin/catalog/${catalogSetId}`);
    return { ok: true, id: row.id, status: row.status };
  } catch (error) {
    if (error instanceof AdminAuthorizationError) return adminError("Không có quyền lưu trữ.");
    return adminError("Lỗi server khi lưu trữ.");
  }
}

// ============================================================
// 5. Replace catalog cards
// ============================================================

export async function adminReplaceCatalogCards(
  catalogSetId: string,
  cards: Array<{ front: string; back: string }>,
  reason?: string,
): Promise<CatalogMutationResult> {
  try {
    const actorId = await getActor();
    const admin = createAdminClient();

    const { data, error } = await admin.rpc("admin_replace_catalog_cards", {
      p_actor_user_id: actorId,
      p_catalog_set_id: catalogSetId,
      p_cards: cards,
      p_reason: reason ?? "card update",
    });

    if (error) {
      const msg = error.message;
      if (msg.includes("max 2000")) return adminError("Tối đa 2000 thẻ mỗi bộ.");
      if (msg.includes("catalog set not found")) return adminError("Không tìm thấy bộ thư viện.");
      return adminError(`Không thể cập nhật thẻ: ${msg}`);
    }

    const row = data?.[0];
    if (!row) return adminError("Không có kết quả từ server.");

    revalidatePath("/admin/catalog");
    revalidatePath(`/admin/catalog/${catalogSetId}`);
    return { ok: true, id: catalogSetId, card_count: row.card_count };
  } catch (error) {
    if (error instanceof AdminAuthorizationError) return adminError("Không có quyền cập nhật thẻ.");
    return adminError("Lỗi server khi cập nhật thẻ.");
  }
}

// ============================================================
// 6. Create catalog set (direct insert, no RPC needed)
// ============================================================

export async function createCatalogSet(input: {
  title: string;
  slug: string;
  description?: string;
  category_id: string;
  language_front: string;
  language_back: string;
  level?: string;
}): Promise<CatalogMutationResult> {
  try {
    await getActor();
    const admin = createAdminClient();

    const { data, error } = await admin
      .from("catalog_sets")
      .insert({
        title: input.title.trim(),
        slug: input.slug.trim(),
        description: input.description?.trim() || null,
        category_id: input.category_id,
        language_front: input.language_front.trim(),
        language_back: input.language_back.trim(),
        level: input.level?.trim() || null,
        status: "draft",
        version: 1,
        is_starter: false,
      })
      .select("id, title, slug, status")
      .single();

    if (error) {
      if (error.code === "23505") return adminError("Slug đã tồn tại. Vui lòng chọn slug khác.");
      return adminError(`Không thể tạo bộ: ${error.message}`);
    }

    revalidatePath("/admin/catalog");
    return { ok: true, id: data.id, title: data.title ?? "", status: data.status ?? "draft" };
  } catch (error) {
    if (error instanceof AdminAuthorizationError)
      return adminError("Không có quyền tạo bộ thư viện.");
    return adminError("Lỗi server khi tạo bộ thư viện.");
  }
}

// ============================================================
// 7. Load catalog set detail + cards
// ============================================================

export async function loadCatalogSetDetail(setId: string) {
  const admin = createAdminClient();

  const { data: set, error: setError } = await admin
    .from("catalog_sets")
    .select("*")
    .eq("id", setId)
    .single();

  if (setError || !set) return null;

  const { data: cards } = await admin
    .from("catalog_cards")
    .select("id, front, back, position")
    .eq("catalog_set_id", setId)
    .order("position", { ascending: true });

  return { set, cards: cards ?? [] };
}
