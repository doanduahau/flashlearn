"use server";

import { revalidatePath } from "next/cache";

import { importPayloadSchema } from "@/features/imports/schemas/import-schema";
import { createClient } from "@/lib/supabase/server";
import { consumeRateLimit, rateLimitMessage, subjectRateLimitKey } from "@/lib/security/rate-limit";

export async function importFlashcards(
  input: unknown,
): Promise<{ setId: string } | { error: string }> {
  const parsed = importPayloadSchema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Dữ liệu import không hợp lệ." };

  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return { error: "Không thể kết nối đến máy chủ. Vui lòng thử lại." };
  }

  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (typeof userId !== "string") return { error: "Phiên đăng nhập đã hết hạn." };

  const rateLimit = await consumeRateLimit("import", subjectRateLimitKey("import", userId));
  if (!rateLimit.ok) return { error: rateLimitMessage(rateLimit) };

  try {
    const { data, error } = await supabase.rpc("import_flashcard_set", {
      p_name: parsed.data.name,
      p_cards: parsed.data.cards,
    });
    if (error || !data?.[0]?.set_id)
      return { error: "Không thể import bộ flashcard. Không có dữ liệu nào được lưu." };
    revalidatePath("/sets");
    revalidatePath("/sets/library");
    return { setId: data[0].set_id };
  } catch {
    return { error: "Không thể tạo bộ flashcard. Vui lòng thử lại." };
  }
}
