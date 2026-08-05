"use server";

import { revalidatePath } from "next/cache";

import { importPayloadSchema } from "@/features/imports/schemas/import-schema";
import { createClient } from "@/lib/supabase/server";

export async function importFlashcards(
  input: unknown,
): Promise<{ setId: string } | { error: string }> {
  const parsed = importPayloadSchema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Dữ liệu import không hợp lệ." };
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return { error: "Phiên đăng nhập đã hết hạn." };
  const { data, error } = await supabase.rpc("import_flashcard_set", {
    p_name: parsed.data.name,
    p_cards: parsed.data.cards,
  });
  if (error || !data?.[0]?.set_id)
    return { error: "Không thể import bộ flashcard. Không có dữ liệu nào được lưu." };
  revalidatePath("/sets");
  return { setId: data[0].set_id };
}
