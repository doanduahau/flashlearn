import type { DraftFlashcard } from "../types/import-types";
import type { FlashcardGenerationProvider } from "../types/import-types";
import { parsePaste } from "../utils/parse-paste";
import { PASTE_MAX_CHARS } from "@/lib/constants";

export type PasteAdapterResult =
  | { kind: "success"; cards: DraftFlashcard[]; aiUsed: boolean }
  | { kind: "error"; message: string };

export type PasteAdapterDeps = {
  provider?: FlashcardGenerationProvider;
};

export async function pasteToDraftCards(
  text: string,
  deps: PasteAdapterDeps = {},
): Promise<PasteAdapterResult> {
  const trimmed = text.trim();
  if (!trimmed) {
    return { kind: "error", message: "Vui lòng dán nội dung." };
  }

  if (trimmed.length > PASTE_MAX_CHARS) {
    return {
      kind: "error",
      message: `Nội dung dán tối đa ${PASTE_MAX_CHARS.toLocaleString("vi-VN")} ký tự.`,
    };
  }

  const analysis = parsePaste(trimmed);

  if (analysis.kind === "structured") {
    const cards = analysis.cards;
    if (cards.length === 0) {
      return { kind: "error", message: "Không tìm thấy thẻ nào trong nội dung đã dán." };
    }
    return { kind: "success", cards, aiUsed: false };
  }

  if (!deps.provider) {
    return {
      kind: "error",
      message: "Nội dung cần AI để phân tích. Vui lòng cấu hình GEMINI_API_KEY.",
    };
  }

  try {
    const cards = await deps.provider.generateCards({ text: trimmed });
    return { kind: "success", cards, aiUsed: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Không thể phân tích nội dung. Vui lòng thử lại.";
    return { kind: "error", message };
  }
}
