"use server";

import {
  answerSchema,
  quizSourceSchema,
  quizStartSchema,
} from "@/features/quiz/schemas/quiz-schema";
import { commitCoverageAndResetScope } from "@/features/practice-coverage/server/actions";
import { collectStudyCardIds } from "@/features/study/server/load-study-cards";
import { reconcileCardSchedule } from "@/features/spaced-repetition/server/reconcile-card-schedule";
import { createClient } from "@/lib/supabase/server";

type Result =
  | { ok: true; sessionId?: string; correct?: boolean; completed?: boolean }
  | { ok: false; error: string };
const generic = "Không thể xử lý bài kiểm tra. Vui lòng thử lại.";

async function signedIn(supabase: Awaited<ReturnType<typeof createClient>>): Promise<boolean> {
  const { data } = await supabase.auth.getClaims();
  return Boolean(data?.claims);
}

async function authenticatedUserId(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string | null> {
  const { data } = await supabase.auth.getClaims();
  const subject = data?.claims?.sub;
  return typeof subject === "string" && subject.length > 0 ? subject : null;
}

function shadowFailureCategory(reason: unknown): string {
  if (typeof reason === "object" && reason !== null && "code" in reason) {
    const code = (reason as { code?: unknown }).code;
    if (typeof code === "string" && /^[A-Z0-9_]{1,24}$/i.test(code)) {
      return `database_${code}`;
    }
  }
  return "unexpected";
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
  const userId = await authenticatedUserId(supabase);
  if (!userId) return { ok: false, error: "Phiên đăng nhập đã hết hạn." };

  const { data, error } = await supabase.rpc("submit_quiz_answer", {
    p_question_id: parsed.data.questionId,
    p_selected_choice_index: parsed.data.selectedChoiceIndex,
  });
  const answer = data?.[0];
  if (error || !answer) return { ok: false, error: generic };

  // Shadow FSRS reconciliation: best-effort, never fails the quiz answer.
  if (answer.flashcard_id && answer.review_event_id) {
    try {
      await reconcileCardSchedule(supabase, userId, answer.flashcard_id as string);
    } catch (reason: unknown) {
      console.error(
        `[fsrs_shadow] reconciliation failed category=${shadowFailureCategory(reason)} ` +
          `quiz_question=${parsed.data.questionId} flashcard=${answer.flashcard_id}`,
      );
    }
  }

  // Commit Quiz coverage on session completion (traditional Quiz only).
  if (answer.completed && answer.session_id) {
    try {
      const { data: questionRows } = await supabase
        .from("quiz_questions")
        .select("flashcard_id")
        .eq("session_id", answer.session_id as string);
      const cardIds = (questionRows ?? [])
        .map((row) => row.flashcard_id)
        .filter((id): id is string => id !== null);

      if (cardIds.length > 0) {
        const { data: sessionData } = await supabase
          .from("quiz_sessions")
          .select("source_set_ids, source_collection_ids")
          .eq("id", answer.session_id as string)
          .maybeSingle();

        const setIds = Array.isArray(sessionData?.source_set_ids)
          ? (sessionData.source_set_ids as string[])
          : [];
        const collectionIds = Array.isArray(sessionData?.source_collection_ids)
          ? (sessionData.source_collection_ids as string[])
          : [];

        if (setIds.length > 0 || collectionIds.length > 0) {
          const scopeIds = await collectStudyCardIds(supabase, {
            all: false,
            setIds,
            collectionIds,
          });
          void commitCoverageAndResetScope("quiz", cardIds, scopeIds);
        } else {
          void commitCoverageAndResetScope("quiz", cardIds, []);
        }
      }
    } catch {
      // Coverage commit is best-effort; never fail the quiz answer.
    }
  }

  return { ok: true, correct: answer.is_correct, completed: answer.completed };
}
