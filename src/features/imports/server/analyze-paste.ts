"use server";

import type { DraftFlashcard } from "@/features/imports/types/import-types";
import { pasteToDraftCards } from "@/features/imports/adapters/paste-adapter";
import { GeminiFlashcardGenerationProvider } from "@/features/imports/adapters/gemini-provider";
import { validateDraftCards } from "@/features/imports/utils/validate-draft-cards";
import { IMPORT_MAX_ROWS, PASTE_MAX_CHARS } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";

type AnalyzeResult =
  | {
      cards: DraftFlashcard[];
      valid: number;
      blank: number;
      partial: number;
      duplicate: number;
      aiUsed: boolean;
    }
  | { error: string };

export async function analyzePasteContent(rawText: unknown): Promise<AnalyzeResult> {
  let supabase;
  try {
    supabase = await createClient();
  } catch (e) {
    return {
      error: `Không thể kết nối đến máy chủ. ${e instanceof Error ? e.message : ""}`,
    };
  }

  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return { error: "Phiên đăng nhập đã hết hạn." };

  if (typeof rawText !== "string") {
    return { error: "Dữ liệu không hợp lệ." };
  }

  const trimmed = rawText.trim();
  if (!trimmed) return { error: "Vui lòng dán nội dung." };

  if (trimmed.length > PASTE_MAX_CHARS) {
    return { error: `Nội dung dán tối đa ${PASTE_MAX_CHARS.toLocaleString("vi-VN")} ký tự.` };
  }

  const provider = new GeminiFlashcardGenerationProvider();
  const result = await pasteToDraftCards(trimmed, { provider });

  if (result.kind === "error") return { error: result.message };

  try {
    const validation = validateDraftCards(result.cards.slice(0, IMPORT_MAX_ROWS));
    return {
      cards: validation.cards,
      valid: validation.valid,
      blank: validation.blank,
      partial: validation.partial,
      duplicate: validation.duplicate,
      aiUsed: result.aiUsed,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Dữ liệu không hợp lệ." };
  }
}
