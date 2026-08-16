import { z } from "zod";

import { QUIZ_MAX_QUESTIONS, QUIZ_MAX_SOURCES } from "@/features/quiz/schemas/quiz-schema";

export const TYPING_MIN_QUESTIONS = 10;
export const TYPING_MAX_QUESTIONS = QUIZ_MAX_QUESTIONS;
export const TYPING_MAX_SOURCES = QUIZ_MAX_SOURCES;

const idList = z.array(z.uuid("Mã bộ flashcard không hợp lệ.")).max(TYPING_MAX_SOURCES);

export const typingSourceSchema = z
  .object({
    all: z.boolean().default(false),
    setIds: idList.default([]),
    collectionIds: idList.default([]),
  })
  .superRefine((value, context) => {
    if (value.setIds.length + value.collectionIds.length > TYPING_MAX_SOURCES) {
      context.addIssue({
        code: "custom",
        message: `Chỉ được chọn tối đa ${TYPING_MAX_SOURCES} nguồn.`,
      });
    }
    if (value.all && value.setIds.length + value.collectionIds.length > 0) {
      context.addIssue({
        code: "custom",
        message: "Tất cả thẻ không thể kết hợp với nguồn khác.",
      });
    }
    if (value.setIds.length > 0 && value.collectionIds.length > 0) {
      context.addIssue({
        code: "custom",
        message: "Chỉ chọn nhiều nguồn trong cùng một khu vực.",
      });
    }
    if (!value.all && value.setIds.length + value.collectionIds.length === 0) {
      context.addIssue({ code: "custom", message: "Hãy chọn ít nhất một nguồn." });
    }
  });

export const typingStartSchema = typingSourceSchema.extend({
  questionCount: z.number().int().min(1).max(TYPING_MAX_QUESTIONS),
});

export const typingAnswerEntrySchema = z.object({
  flashcardId: z.uuid("Mã thẻ không hợp lệ."),
  answer: z.string().max(4000, "Đáp án quá dài.").default(""),
});

export const submitTypingAttemptSchema = z
  .object({
    coverageSessionId: z.uuid("Phiên luyện tập không hợp lệ."),
    sourceSetIds: idList.default([]),
    sourceCollectionIds: idList.default([]),
    sourceAll: z.boolean().default(false),
    totalQuestions: z.number().int().min(1).max(TYPING_MAX_QUESTIONS),
    elapsedMs: z.number().int().min(0, "Thời gian không hợp lệ."),
    answers: z.array(typingAnswerEntrySchema).min(1).max(TYPING_MAX_QUESTIONS),
  })
  .superRefine((value, context) => {
    if (value.answers.length !== value.totalQuestions) {
      context.addIssue({
        code: "custom",
        message: "Số câu trả lời không khớp với bài kiểm tra.",
      });
    }
    const seen = new Set<string>();
    for (const answer of value.answers) {
      if (seen.has(answer.flashcardId)) {
        context.addIssue({ code: "custom", message: "Mỗi thẻ chỉ được trả lời một lần." });
        break;
      }
      seen.add(answer.flashcardId);
    }
  });

export const retryTypingSaveSchema = z.object({
  coverageSessionId: z.uuid("Phiên luyện tập không hợp lệ."),
  sourceSetIds: idList.default([]),
  sourceCollectionIds: idList.default([]),
  sourceAll: z.boolean().default(false),
  totalQuestions: z.number().int().min(1).max(TYPING_MAX_QUESTIONS),
  correctCount: z.number().int().min(0).max(TYPING_MAX_QUESTIONS),
  elapsedMs: z.number().int().min(0, "Thời gian không hợp lệ."),
  answers: z
    .array(
      z.object({
        flashcardId: z.uuid("Mã thẻ không hợp lệ."),
        isCorrect: z.boolean(),
      }),
    )
    .min(1)
    .max(TYPING_MAX_QUESTIONS),
});
