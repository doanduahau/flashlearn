import { z } from "zod";

import { CARD_TEXT_MAX_LENGTH, SET_NAME_MAX_LENGTH } from "@/lib/constants";

export const renameSetSchema = z.object({
  setId: z.uuid("Mã bộ flashcard không hợp lệ."),
  name: z
    .string()
    .trim()
    .min(1, "Tên bộ flashcard không được để trống.")
    .max(SET_NAME_MAX_LENGTH, `Tên bộ flashcard tối đa ${SET_NAME_MAX_LENGTH} ký tự.`),
});

export const deleteSetSchema = z.object({
  setId: z.uuid("Mã bộ flashcard không hợp lệ."),
});

const cardFieldsSchema = z.object({
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
});

export const createCardSchema = cardFieldsSchema.extend({
  setId: z.uuid("Mã bộ flashcard không hợp lệ."),
});

export const updateCardSchema = cardFieldsSchema.extend({
  setId: z.uuid("Mã bộ flashcard không hợp lệ."),
  cardId: z.uuid("Mã flashcard không hợp lệ."),
});

export const deleteCardSchema = z.object({
  setId: z.uuid("Mã bộ flashcard không hợp lệ."),
  cardId: z.uuid("Mã flashcard không hợp lệ."),
});
