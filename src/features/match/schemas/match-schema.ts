import { z } from "zod";

import { MATCH_QUESTION_COUNTS } from "../types/match-types";

export const matchQuestionCountSchema = z
  .number()
  .int()
  .refine((value): value is 12 | 18 | 24 => MATCH_QUESTION_COUNTS.includes(value as never));

export const matchStartSchema = z.object({
  all: z.boolean().default(false),
  setIds: z.array(z.uuid("Mã bộ flashcard không hợp lệ.")).default([]),
  collectionIds: z.array(z.uuid("Mã bộ đặc biệt không hợp lệ.")).default([]),
  questionCount: matchQuestionCountSchema,
});
