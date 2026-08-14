import { z } from "zod";

import type { RunnerQuestion } from "../types/runner-types";

/**
 * Boundary schema for the `load_runner_session_questions` RPC output. Each row
 * carries a snake_case payload with exactly three string choices; the correct
 * answer must be one of them.
 */
export const runnerSessionPayloadSchema = z
  .array(
    z.object({
      flashcard_id: z.uuid(),
      front: z.string(),
      correct_answer: z.string(),
      choices: z.tuple([z.string(), z.string(), z.string()]),
    }),
  )
  .superRefine((rows, context) => {
    rows.forEach((row, index) => {
      if (!row.choices.includes(row.correct_answer)) {
        context.addIssue({
          code: "custom",
          message: "Đáp án đúng không nằm trong các lựa chọn.",
          path: [index, "correct_answer"],
        });
      }
    });
  });

/**
 * Validates and maps the RPC output to the Task 2 `RunnerQuestion` domain
 * shape. Preserves the prepared choice order (the DB already shuffled it).
 * Throws on any invalid row.
 */
export function mapRunnerSessionRows(rows: unknown): RunnerQuestion[] {
  const parsed = runnerSessionPayloadSchema.parse(rows);
  return parsed.map((row) => ({
    flashcardId: row.flashcard_id,
    front: row.front,
    correctAnswer: row.correct_answer,
    choices: row.choices,
  }));
}
