"use server";

import { revalidatePath } from "next/cache";
import type { ZodError } from "zod";

import {
  createCardSchema,
  deleteCardSchema,
  deleteSetSchema,
  moveSetSchema,
  renameSetSchema,
  updateCardSchema,
} from "@/features/flashcard-sets/schemas/set-schema";
import {
  mapMutationError,
  type MutationResult,
} from "@/features/flashcard-sets/utils/mutation-error";
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

export async function renameSet(input: unknown): Promise<MutationResult> {
  const parsed = renameSetSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssueMessage(parsed.error) };

  const supabase = await createClient();
  if (!(await hasAuthenticatedSession(supabase)))
    return { ok: false, error: "Phiên đăng nhập đã hết hạn." };

  const { data, error } = await supabase
    .from("flashcard_sets")
    .update({ name: parsed.data.name })
    .eq("id", parsed.data.setId)
    .select("id");

  if (error) return { ok: false, error: mapMutationError(error) };
  if (!data?.length) return { ok: false, error: "Không tìm thấy bộ flashcard." };

  revalidatePath(`/sets/${parsed.data.setId}`);
  revalidatePath("/sets");
  return { ok: true };
}

export async function deleteSet(input: unknown): Promise<MutationResult> {
  const parsed = deleteSetSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssueMessage(parsed.error) };

  const supabase = await createClient();
  if (!(await hasAuthenticatedSession(supabase)))
    return { ok: false, error: "Phiên đăng nhập đã hết hạn." };

  const { data, error } = await supabase
    .from("flashcard_sets")
    .delete()
    .eq("id", parsed.data.setId)
    .select("id");

  if (error) return { ok: false, error: mapMutationError(error) };
  if (!data?.length) return { ok: false, error: "Không tìm thấy bộ flashcard." };

  revalidatePath("/sets");
  return { ok: true };
}

export async function moveSet(input: unknown): Promise<MutationResult> {
  const parsed = moveSetSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssueMessage(parsed.error) };

  const supabase = await createClient();
  if (!(await hasAuthenticatedSession(supabase)))
    return { ok: false, error: "Phiên đăng nhập đã hết hạn." };

  const { error } = await supabase.rpc("move_flashcard_set", {
    p_set_id: parsed.data.setId,
    p_direction: parsed.data.direction,
  });

  if (error) return { ok: false, error: mapMutationError(error) };

  revalidatePath("/sets");
  revalidatePath("/study");
  revalidatePath("/quiz");
  return { ok: true };
}

export async function addCard(input: unknown): Promise<MutationResult> {
  const parsed = createCardSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssueMessage(parsed.error) };

  const supabase = await createClient();
  if (!(await hasAuthenticatedSession(supabase)))
    return { ok: false, error: "Phiên đăng nhập đã hết hạn." };

  const { data, error } = await supabase.rpc("add_flashcard", {
    p_set_id: parsed.data.setId,
    p_front: parsed.data.front,
    p_back: parsed.data.back,
  });

  if (error) return { ok: false, error: mapMutationError(error) };
  if (!data?.length) return { ok: false, error: "Không thể thêm flashcard." };

  revalidatePath(`/sets/${parsed.data.setId}`);
  revalidatePath("/sets");
  return { ok: true };
}

export async function updateCard(input: unknown): Promise<MutationResult> {
  const parsed = updateCardSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssueMessage(parsed.error) };

  const supabase = await createClient();
  if (!(await hasAuthenticatedSession(supabase)))
    return { ok: false, error: "Phiên đăng nhập đã hết hạn." };

  const { data, error } = await supabase
    .from("flashcards")
    .update({ front: parsed.data.front, back: parsed.data.back })
    .eq("id", parsed.data.cardId)
    .eq("set_id", parsed.data.setId)
    .select("id");

  if (error) return { ok: false, error: mapMutationError(error) };
  if (!data?.length) return { ok: false, error: "Không tìm thấy flashcard." };

  revalidatePath(`/sets/${parsed.data.setId}`);
  return { ok: true };
}

export async function deleteCard(input: unknown): Promise<MutationResult> {
  const parsed = deleteCardSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssueMessage(parsed.error) };

  const supabase = await createClient();
  if (!(await hasAuthenticatedSession(supabase)))
    return { ok: false, error: "Phiên đăng nhập đã hết hạn." };

  const { data, error } = await supabase
    .from("flashcards")
    .delete()
    .eq("id", parsed.data.cardId)
    .eq("set_id", parsed.data.setId)
    .select("id");

  if (error) return { ok: false, error: mapMutationError(error) };
  if (!data?.length) return { ok: false, error: "Không tìm thấy flashcard." };

  revalidatePath(`/sets/${parsed.data.setId}`);
  return { ok: true };
}
