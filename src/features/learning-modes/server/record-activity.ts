"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const recordActivitySchema = z.object({
  mode: z.enum(["match", "typing", "memory", "runner", "study"]),
  questionsAnswered: z.number().int().min(0),
  correctAnswers: z.number().int().min(0),
});

export type RecordActivityResult = { ok: true } | { ok: false; error: string };

const generic = "Không thể cập nhật hoạt động hôm nay. Vui lòng thử lại.";

/**
 * Marks a completed learning/quiz mode on the user's daily activity record so
 * every mode feeds the streak (quiz is already recorded by submit_quiz_answer,
 * so this action covers the other five modes). Quiz/matching/typing also add
 * their question counts; memory/runner/study only keep the day active.
 */
export async function recordDailyActivity(input: unknown): Promise<RecordActivityResult> {
  const parsed = recordActivitySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: generic };

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (typeof userId !== "string" || userId.length === 0) {
    return { ok: false, error: "Phiên đăng nhập đã hết hạn." };
  }

  const admin = createAdminClient();
  const { error } = await admin.rpc("record_daily_activity", {
    p_user_id: userId,
    p_mode: parsed.data.mode,
    p_questions_answered: parsed.data.questionsAnswered,
    p_correct_answers: parsed.data.correctAnswers,
  });
  if (error) return { ok: false, error: generic };

  revalidatePath("/dashboard");
  revalidatePath("/profile");
  return { ok: true };
}
