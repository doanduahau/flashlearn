import { z } from "zod";

import { MEMORY_QUESTION_COUNTS } from "../types/memory-types";

export const memoryQuestionCountSchema = z
  .number()
  .int()
  .refine((value): value is 12 | 18 | 24 => MEMORY_QUESTION_COUNTS.includes(value as never));

export const memoryStartSchema = z
  .object({
    all: z.boolean().default(false),
    setIds: z.array(z.uuid("Mã bộ flashcard không hợp lệ.")).max(50).default([]),
    collectionIds: z.array(z.uuid("Mã bộ đặc biệt không hợp lệ.")).max(50).default([]),
    questionCount: memoryQuestionCountSchema,
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
