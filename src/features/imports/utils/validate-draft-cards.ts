import type { DraftFlashcard } from "../types/import-types";
import { IMPORT_MAX_ROWS } from "@/lib/constants";

export type DraftCardValidation = {
  totalInput: number;
  blank: number;
  partial: number;
  duplicate: number;
  valid: number;
  cards: DraftFlashcard[];
};

export function validateDraftCards(input: readonly DraftFlashcard[]): DraftCardValidation {
  let blank = 0;
  let partial = 0;
  let duplicate = 0;
  const seen = new Set<string>();
  const cards: DraftFlashcard[] = [];

  for (const card of input) {
    const frontEmpty = card.front.length === 0;
    const backEmpty = card.back.length === 0;

    if (frontEmpty && backEmpty) {
      blank += 1;
      continue;
    }

    if (frontEmpty || backEmpty) {
      partial += 1;
      continue;
    }

    const key = `${card.front}\u0000${card.back}`;
    if (seen.has(key)) {
      duplicate += 1;
      continue;
    }
    seen.add(key);

    cards.push(card);
  }

  const valid = cards.length;
  if (valid > IMPORT_MAX_ROWS) {
    throw new Error(`Vượt quá ${IMPORT_MAX_ROWS.toLocaleString("vi-VN")} thẻ hợp lệ.`);
  }

  return {
    totalInput: input.length,
    blank,
    partial,
    duplicate,
    valid,
    cards,
  };
}
