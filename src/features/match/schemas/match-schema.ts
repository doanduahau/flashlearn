import { z } from "zod";

import { MATCH_QUESTION_COUNTS } from "../types/match-types";

export const matchQuestionCountSchema = z
  .number()
  .int()
  .refine((value): value is 12 | 18 | 24 => MATCH_QUESTION_COUNTS.includes(value as never));

export const matchStartSchema = z
  .object({
    all: z.boolean().default(false),
    setIds: z.array(z.uuid("Mã bộ flashcard không hợp lệ.")).max(50).default([]),
    collectionIds: z.array(z.uuid("Mã bộ đặc biệt không hợp lệ.")).max(50).default([]),
    questionCount: matchQuestionCountSchema,
  })
  .superRefine((value, context) => {
    if (value.all && value.setIds.length + value.collectionIds.length > 0) {
      context.addIssue({ code: "custom", message: "Tất cả thẻ không thể kết hợp với nguồn khác." });
    }
    if (value.setIds.length > 0 && value.collectionIds.length > 0) {
      context.addIssue({ code: "custom", message: "Chỉ chọn nhiều nguồn trong cùng một khu vực." });
    }
    if (!value.all && value.setIds.length + value.collectionIds.length === 0) {
      context.addIssue({ code: "custom", message: "Hãy chọn ít nhất một nguồn." });
    }
  });

export const saveMatchAttemptSchema = z
  .object({
    sourceSetIds: z.array(z.uuid("Mã bộ flashcard không hợp lệ.")).max(50).default([]),
    sourceCollectionIds: z.array(z.uuid("Mã bộ đặc biệt không hợp lệ.")).max(50).default([]),
    sourceAll: z.boolean().default(false),
    totalPairs: z.number().int().positive("Số cặp không hợp lệ."),
    correctPairs: z.number().int().min(0, "Số cặp ghép đúng không hợp lệ."),
    incorrectAttempts: z.number().int().min(0, "Số lần ghép sai không hợp lệ."),
    elapsedMs: z.number().int().min(0, "Thời gian không hợp lệ."),
  })
  .superRefine((value, context) => {
    if (value.correctPairs > value.totalPairs) {
      context.addIssue({
        code: "custom",
        message: "Số cặp ghép đúng không thể lớn hơn tổng số cặp.",
      });
    }
  });
