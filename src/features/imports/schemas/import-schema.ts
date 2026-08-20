import { z } from "zod";

import { CARD_TEXT_MAX_LENGTH, IMPORT_MAX_ROWS, SET_NAME_MAX_LENGTH } from "@/lib/constants";

export const importCommitSourceSchema = z.enum([
  "manual",
  "csv_xlsx",
  "google_sheets",
  "paste_structured",
  "paste_prose",
  "docx",
  "pdf",
]);

export const importPayloadSchema = z.object({
  idempotencyKey: z.uuid("Mã yêu cầu import không hợp lệ."),
  source: importCommitSourceSchema,
  sourceBytes: z.number().int().nonnegative().max(250_000_000),
  sourceChars: z.number().int().nonnegative().max(250_000_000),
  aiUsed: z.boolean(),
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
