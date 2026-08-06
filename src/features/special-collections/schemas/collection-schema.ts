import { z } from "zod";

import { COLLECTION_MAX_MEMBERSHIP_IDS, COLLECTION_NAME_MAX_LENGTH } from "@/lib/constants";

const collectionNameField = z
  .string()
  .trim()
  .min(1, "Tên bộ không được để trống.")
  .max(COLLECTION_NAME_MAX_LENGTH, `Tên bộ tối đa ${COLLECTION_NAME_MAX_LENGTH} ký tự.`);

export const createCollectionSchema = z.object({
  name: collectionNameField,
});

export const renameCollectionSchema = z.object({
  collectionId: z.uuid("Mã bộ đặc biệt không hợp lệ."),
  name: collectionNameField,
});

export const deleteCollectionSchema = z.object({
  collectionId: z.uuid("Mã bộ đặc biệt không hợp lệ."),
});

export const removeCollectionItemSchema = z.object({
  collectionId: z.uuid("Mã bộ đặc biệt không hợp lệ."),
  cardId: z.uuid("Mã flashcard không hợp lệ."),
});

export const updateCardCollectionsSchema = z.object({
  cardId: z.uuid("Mã flashcard không hợp lệ."),
  setId: z.uuid("Mã bộ flashcard không hợp lệ."),
  collectionIds: z
    .array(z.uuid("Mã bộ đặc biệt không hợp lệ."))
    .max(COLLECTION_MAX_MEMBERSHIP_IDS, `Tối đa ${COLLECTION_MAX_MEMBERSHIP_IDS} bộ.`),
});
