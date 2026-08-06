import { z } from "zod";

import { CARD_TEXT_MAX_LENGTH, IMPORT_MAX_ROWS, SET_NAME_MAX_LENGTH } from "@/lib/constants";

export const importPayloadSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Nhập tên bộ flashcard.")
    .max(SET_NAME_MAX_LENGTH, `Tên bộ flashcard tối đa ${SET_NAME_MAX_LENGTH} ký tự.`),
  cards: z
    .array(
      z.object({
        front: z
          .string()
          .trim()
          .min(1, "Mặt trước không được để trống.")
          .max(CARD_TEXT_MAX_LENGTH, `Mặt trước tối đa ${CARD_TEXT_MAX_LENGTH} ký tự.`),
        back: z
          .string()
          .trim()
          .min(1, "Mặt sau không được để trống.")
          .max(CARD_TEXT_MAX_LENGTH, `Mặt sau tối đa ${CARD_TEXT_MAX_LENGTH} ký tự.`),
      }),
    )
    .min(1, "Thêm ít nhất một flashcard.")
    .max(IMPORT_MAX_ROWS, `Một bộ tối đa ${IMPORT_MAX_ROWS} flashcard.`),
});
