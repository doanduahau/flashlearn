"use server";

import { revalidatePath } from "next/cache";
import type { ZodError } from "zod";

import {
  createCollectionSchema,
  deleteCollectionSchema,
  removeCollectionItemSchema,
  renameCollectionSchema,
  updateCardCollectionsSchema,
} from "@/features/special-collections/schemas/collection-schema";
import { mapMutationError, type MutationResult } from "@/lib/mutation-error";
import { createClient } from "@/lib/supabase/server";

function firstIssueMessage(error: ZodError): string {
  return error.issues[0]?.message ?? "Dữ liệu không hợp lệ.";
}

async function hasAuthenticatedSession(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<boolean> {
  const { data } = await supabase.auth.getClaims();
  return Boolean(data?.claims);
}

export async function createCollection(input: unknown): Promise<MutationResult> {
  const parsed = createCollectionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssueMessage(parsed.error) };

  const supabase = await createClient();
  if (!(await hasAuthenticatedSession(supabase)))
    return { ok: false, error: "Phiên đăng nhập đã hết hạn." };

  const { error } = await supabase.rpc("create_special_collection_with_quota", {
    p_name: parsed.data.name,
  });

  if (error) return { ok: false, error: mapMutationError(error) };

  revalidatePath("/collections");
  return { ok: true };
}

export async function renameCollection(input: unknown): Promise<MutationResult> {
  const parsed = renameCollectionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssueMessage(parsed.error) };

  const supabase = await createClient();
  if (!(await hasAuthenticatedSession(supabase)))
    return { ok: false, error: "Phiên đăng nhập đã hết hạn." };

  const { data, error } = await supabase
    .from("special_collections")
    .update({ name: parsed.data.name })
    .eq("id", parsed.data.collectionId)
    .select("id");

  if (error) return { ok: false, error: mapMutationError(error) };
  if (!data?.length) return { ok: false, error: "Không tìm thấy bộ đặc biệt." };

  revalidatePath(`/collections/${parsed.data.collectionId}`);
  revalidatePath("/collections");
  return { ok: true };
}

export async function deleteCollection(input: unknown): Promise<MutationResult> {
  const parsed = deleteCollectionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssueMessage(parsed.error) };

  const supabase = await createClient();
  if (!(await hasAuthenticatedSession(supabase)))
    return { ok: false, error: "Phiên đăng nhập đã hết hạn." };

  const { data, error } = await supabase
    .from("special_collections")
    .delete()
    .eq("id", parsed.data.collectionId)
    .select("id");

  if (error) return { ok: false, error: mapMutationError(error) };
  if (!data?.length) return { ok: false, error: "Không tìm thấy bộ đặc biệt." };

  revalidatePath("/collections");
  return { ok: true };
}

export async function removeCollectionItem(input: unknown): Promise<MutationResult> {
  const parsed = removeCollectionItemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssueMessage(parsed.error) };

  const supabase = await createClient();
  if (!(await hasAuthenticatedSession(supabase)))
    return { ok: false, error: "Phiên đăng nhập đã hết hạn." };

  const { data, error } = await supabase
    .from("special_collection_items")
    .delete()
    .eq("collection_id", parsed.data.collectionId)
    .eq("flashcard_id", parsed.data.cardId)
    .select("flashcard_id");

  if (error) return { ok: false, error: mapMutationError(error) };
  if (!data?.length) return { ok: false, error: "Không tìm thấy thẻ trong bộ." };

  revalidatePath(`/collections/${parsed.data.collectionId}`);
  revalidatePath("/collections");
  return { ok: true };
}

export async function updateCardCollections(input: unknown): Promise<MutationResult> {
  const parsed = updateCardCollectionsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssueMessage(parsed.error) };

  const supabase = await createClient();
  if (!(await hasAuthenticatedSession(supabase)))
    return { ok: false, error: "Phiên đăng nhập đã hết hạn." };

  const { data, error } = await supabase.rpc("set_card_collections", {
    p_card_id: parsed.data.cardId,
    p_collection_ids: parsed.data.collectionIds,
  });

  if (error) return { ok: false, error: mapMutationError(error) };
  if (data !== "ok") return { ok: false, error: "Không thể cập nhật bộ đặc biệt." };

  revalidatePath(`/sets/${parsed.data.setId}`);
  revalidatePath("/collections");
  return { ok: true };
}
