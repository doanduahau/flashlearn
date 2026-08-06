"use server";

import {
  answerSchema,
  quizSourceSchema,
  quizStartSchema,
} from "@/features/quiz/schemas/quiz-schema";
import { collectStudyCardIds } from "@/features/study/server/load-study-cards";
import { createClient } from "@/lib/supabase/server";

type Result =
  | { ok: true; sessionId?: string; correct?: boolean; completed?: boolean }
  | { ok: false; error: string };
const generic = "Không thể xử lý bài kiểm tra. Vui lòng thử lại.";

async function signedIn(supabase: Awaited<ReturnType<typeof createClient>>): Promise<boolean> {
  const { data } = await supabase.auth.getClaims();
  return Boolean(data?.claims);
}

export async function startQuiz(input: unknown): Promise<Result> {
  const parsed = quizStartSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? generic };
  const supabase = await createClient();
  if (!(await signedIn(supabase))) return { ok: false, error: "Phiên đăng nhập đã hết hạn." };
  const { data, error } = await supabase.rpc("create_quiz_session", {
    p_mode: parsed.data.mode,
    p_set_ids: parsed.data.setIds,
    p_collection_ids: parsed.data.collectionIds,
    p_all: parsed.data.all,
    p_question_count: parsed.data.questionCount,
  });
  return error || !data ? { ok: false, error: generic } : { ok: true, sessionId: data };
}

export async function getQuizCardCount(
  input: unknown,
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const parsed = quizSourceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? generic };
  const supabase = await createClient();
  if (!(await signedIn(supabase))) return { ok: false, error: "Phiên đăng nhập đã hết hạn." };

  const ids = await collectStudyCardIds(supabase, {
    all: false,
    setIds: parsed.data.setIds,
    collectionIds: parsed.data.collectionIds,
  });
  return { ok: true, count: ids.length };
}

export async function submitQuizAnswer(input: unknown): Promise<Result> {
  const parsed = answerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Câu trả lời không hợp lệ." };
  const supabase = await createClient();
  if (!(await signedIn(supabase))) return { ok: false, error: "Phiên đăng nhập đã hết hạn." };
  const { data, error } = await supabase.rpc("submit_quiz_answer", {
    p_question_id: parsed.data.questionId,
    p_selected_choice_index: parsed.data.selectedChoiceIndex,
  });
  const answer = data?.[0];
  if (error || !answer) return { ok: false, error: generic };
  return { ok: true, correct: answer.is_correct, completed: answer.completed };
}
