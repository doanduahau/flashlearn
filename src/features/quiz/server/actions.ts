"use server";

import { randomInt } from "node:crypto";

import {
  answerSchema,
  quizEligibilitySchema,
  quizStartSchema,
} from "@/features/quiz/schemas/quiz-schema";
import { completeLearningCoverageSession } from "@/features/practice-coverage/server/actions";
import { selectCardsByPriority } from "@/features/learning-modes/types";
import { collectStudyCardIds } from "@/features/study/server/load-study-cards";
import { seededShuffle } from "@/features/study/utils/shuffle";
import { reconcileCardSchedule } from "@/features/spaced-repetition/server/reconcile-card-schedule";
import { createAdminClient } from "@/lib/supabase/admin";
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

function appearanceMapFrom(raw: unknown): Map<string, number> {
  const map = new Map<string, number>();
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    for (const [id, count] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof count === "number") map.set(id, count);
    }
  }
  return map;
}

export async function startQuiz(input: unknown): Promise<Result> {
  const parsed = quizStartSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? generic };
  const supabase = await createClient();
  const userId = await authenticatedUserId(supabase);
  if (!userId) return { ok: false, error: "Phiên đăng nhập đã hết hạn." };

  try {
    const poolIds = await collectStudyCardIds(supabase, {
      all: parsed.data.all,
      setIds: parsed.data.setIds,
      collectionIds: parsed.data.collectionIds,
    });
    if (poolIds.length < parsed.data.questionCount) {
      return { ok: false, error: "Không đủ thẻ để tạo bài kiểm tra." };
    }

    // Wrong-first, then least-appeared — the shared policy. The shuffled pool
    // makes equal-appearance ties deterministic but varied.
    const shuffled = seededShuffle(poolIds, randomInt(0, 2 ** 32));
    const { data: scope, error: scopeError } = await supabase.rpc("get_quiz_scope_sets", {
      p_set_ids: parsed.data.setIds,
      p_collection_ids: parsed.data.collectionIds,
      p_all: parsed.data.all,
    });
    if (scopeError) throw scopeError;
    const firstScope = Array.isArray(scope) ? scope[0] : scope;
    const selectedIds = selectCardsByPriority(
      shuffled,
      new Set(firstScope?.wrong_ids ?? []),
      appearanceMapFrom(firstScope?.appearance_counts),
      parsed.data.questionCount,
    );

    const admin = createAdminClient();
    const { data: sessionId, error } = await admin.rpc("create_quiz_session_prioritized", {
      p_user_id: userId,
      p_card_ids: selectedIds,
      p_scope_card_ids: poolIds,
      p_question_count: parsed.data.questionCount,
    });
    if (error || !sessionId) return { ok: false, error: generic };
    return { ok: true, sessionId };
  } catch {
    return { ok: false, error: generic };
  }
}

/**
 * Reports the strict eligible pool sizes for the three filters over the
 * selected source scope, so the setup UI can render "Tất cả N" and cap fixed
 * counts without ever backfilling.
 */
export async function getQuizEligibility(
  input: unknown,
): Promise<
  { ok: true; total: number; uncovered: number; wrong: number } | { ok: false; error: string }
> {
  const parsed = quizEligibilitySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? generic };
  const supabase = await createClient();
  if (!(await signedIn(supabase))) return { ok: false, error: "Phiên đăng nhập đã hết hạn." };

  const { data: scope, error: scopeError } = await supabase.rpc("get_quiz_scope_sets", {
    p_set_ids: parsed.data.setIds,
    p_collection_ids: parsed.data.collectionIds,
    p_all: parsed.data.all,
  });
  if (scopeError) return { ok: false, error: generic };
  const firstScope = Array.isArray(scope) ? scope[0] : scope;
  const appearance = appearanceMapFrom(firstScope?.appearance_counts);
  return {
    ok: true,
    total: firstScope?.total ?? 0,
    uncovered: Array.from(appearance.values()).filter((count) => count === 0).length,
    wrong: firstScope?.wrong_ids?.length ?? 0,
  };
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

  // Quiz coverage is a separate, retry-safe transaction.  Only a durable
  // manual-Quiz ledger row can complete; Smart Review and New Cards have none.
  if (answer.completed && answer.session_id) {
    try {
      const { data: session } = await supabase
        .from("quiz_sessions")
        .select("origin")
        .eq("id", answer.session_id as string)
        .maybeSingle();
      if (session?.origin === "manual") {
        const { data: coverageSession } = await supabase
          .from("learning_coverage_sessions")
          .select("id")
          .eq("quiz_session_id", answer.session_id as string)
          .eq("mode", "quiz")
          .maybeSingle();
        if (coverageSession?.id) await completeLearningCoverageSession(coverageSession.id);
      }
    } catch {
      // A retry of the final answer repeats the same idempotent completion.
      // Never let a derived coverage failure invalidate the authoritative quiz.
    }
  }

  return { ok: true, correct: answer.is_correct, completed: answer.completed };
}
