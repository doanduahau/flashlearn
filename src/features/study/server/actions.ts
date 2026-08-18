"use server";

import { recordDailyActivity } from "@/features/learning-modes/server/record-activity";
import { createClient } from "@/lib/supabase/server";

async function hasAuthenticatedSession(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<boolean> {
  const { data } = await supabase.auth.getClaims();
  return Boolean(data?.claims);
}

export type CompleteStudyResult = { ok: true } | { ok: false; error: string };

/**
 * Marks a completed flashcard (flip) study session on the daily activity
 * record so the streak counts study mode too. Errors are non-blocking for the
 * completion screen — the client shows a retry prompt.
 */
export async function completeStudySession(): Promise<CompleteStudyResult> {
  const supabase = await createClient();
  if (!(await hasAuthenticatedSession(supabase)))
    return { ok: false, error: "Phiên đăng nhập đã hết hạn." };

  return recordDailyActivity({ mode: "study", questionsAnswered: 0, correctAnswers: 0 });
}
