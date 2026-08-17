"use server";

import type { ZodError } from "zod";

import { studySourceSchema } from "@/features/study/schemas/study-schema";
import { collectStudyCardIds } from "@/features/study/server/load-study-cards";
import { recordDailyActivity } from "@/features/learning-modes/server/record-activity";
import { createClient } from "@/lib/supabase/server";

export type StudyCountResult = { ok: true; count: number } | { ok: false; error: string };

function firstIssueMessage(error: ZodError): string {
  return error.issues[0]?.message ?? "Dữ liệu không hợp lệ.";
}

async function hasAuthenticatedSession(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<boolean> {
  const { data } = await supabase.auth.getClaims();
  return Boolean(data?.claims);
}

export async function getStudyCardCount(input: unknown): Promise<StudyCountResult> {
  const parsed = studySourceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssueMessage(parsed.error) };

  const supabase = await createClient();
  if (!(await hasAuthenticatedSession(supabase)))
    return { ok: false, error: "Phiên đăng nhập đã hết hạn." };

  const ids = await collectStudyCardIds(supabase, {
    all: false,
    setIds: parsed.data.setIds,
    collectionIds: parsed.data.collectionIds,
  });

  return { ok: true, count: ids.length };
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
