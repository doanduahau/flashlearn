"use server";

import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const recordModeAnswersSchema = z.object({
  mode: z.enum(["match", "typing"]),
  answers: z
    .array(
      z.object({
        flashcardId: z.string().uuid(),
        isCorrect: z.boolean(),
      }),
    )
    .max(200),
});

export type RecordModeAnswersResult = { ok: true } | { ok: false; error: string };

const generic = "Không thể lưu kết quả lúc này.";

/**
 * Persists one answer event per card for a quiz-like mode (match/typing).
 * The database owns the per-card latest-answer history that feeds the shared
 * wrong-answer loader, so every mode is treated identically for "Cần ôn".
 */
export async function recordModeAnswers(input: unknown): Promise<RecordModeAnswersResult> {
  const parsed = recordModeAnswersSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: generic };

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (typeof userId !== "string" || userId.length === 0) {
    return { ok: false, error: "Phiên đăng nhập đã hết hạn." };
  }

  const admin = createAdminClient();
  const { error } = await admin.rpc("record_mode_answers", {
    p_user_id: userId,
    p_mode: parsed.data.mode,
    p_answers: parsed.data.answers.map((answer) => ({
      flashcard_id: answer.flashcardId,
      is_correct: answer.isCorrect,
    })),
  });
  if (error) return { ok: false, error: generic };

  return { ok: true };
}
