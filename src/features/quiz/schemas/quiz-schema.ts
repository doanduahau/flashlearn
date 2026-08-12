import { z } from "zod";

export const QUIZ_MIN_QUESTIONS = 10;
export const QUIZ_MAX_QUESTIONS = 100;
export const QUIZ_MAX_SOURCES = 50;

export const quizModes = ["balanced", "never_tested", "wrong_answers", "pure_random"] as const;
export type QuizMode = (typeof quizModes)[number];

const idList = z.array(z.uuid()).max(QUIZ_MAX_SOURCES);

export const quizSourceSchema = z
  .object({
    setIds: idList.default([]),
    collectionIds: idList.default([]),
  })
  .superRefine((value, context) => {
    if (value.setIds.length + value.collectionIds.length > QUIZ_MAX_SOURCES) {
      context.addIssue({
        code: "custom",
        message: `Chỉ được chọn tối đa ${QUIZ_MAX_SOURCES} nguồn.`,
      });
    }
    if (value.setIds.length > 0 && value.collectionIds.length > 0) {
      context.addIssue({
        code: "custom",
        message: "Chỉ chọn nhiều nguồn trong cùng một khu vực.",
      });
    }
  });

export const quizStartSchema = z
  .object({
    mode: z.enum(quizModes),
    setIds: idList.default([]),
    collectionIds: idList.default([]),
    all: z.boolean(),
    questionCount: z.number().int().min(QUIZ_MIN_QUESTIONS).max(QUIZ_MAX_QUESTIONS),
  })
  .superRefine((value, context) => {
    if (value.setIds.length + value.collectionIds.length > QUIZ_MAX_SOURCES) {
      context.addIssue({
        code: "custom",
        message: `Chỉ được chọn tối đa ${QUIZ_MAX_SOURCES} nguồn.`,
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

export const answerSchema = z.object({
  questionId: z.uuid(),
  selectedChoiceIndex: z.number().int().min(0).max(3),
});
