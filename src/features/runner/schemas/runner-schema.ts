import { z } from "zod";

import { learningFilters } from "@/features/learning-modes/types";
import { RUNNER_QUESTION_COUNTS } from "../types/runner-types";

export const runnerQuestionCountSchema = z
  .number()
  .int()
  .refine((value): value is 12 | 18 | 24 => RUNNER_QUESTION_COUNTS.includes(value as never));

export const runnerStartSchema = z
  .object({
    all: z.boolean().default(false),
    setIds: z.array(z.uuid("Mã bộ flashcard không hợp lệ.")).max(50).default([]),
    collectionIds: z.array(z.uuid("Mã bộ đặc biệt không hợp lệ.")).max(50).default([]),
    questionCount: runnerQuestionCountSchema,
    filter: z.enum(learningFilters).default("unseen"),
    difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
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

export const runnerBestTimeSchema = z.object({
  runnerSessionId: z.uuid("Mã phiên Runner không hợp lệ."),
  elapsedMs: z.number().finite().int().positive("Thời gian hoàn thành không hợp lệ."),
});
