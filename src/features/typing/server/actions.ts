"use server";

import { randomInt } from "node:crypto";

import {
  retryTypingSaveSchema,
  submitTypingAttemptSchema,
  TYPING_MAX_QUESTIONS,
  TYPING_MIN_QUESTIONS,
  typingSourceSchema,
  typingStartSchema,
} from "@/features/typing/schemas/typing-schema";
import type {
  StartedTypingSession,
  TypingAvailability,
  TypingCard,
  TypingSubmitResult,
} from "@/features/typing/types/typing-types";
import { gradeTypingAnswer } from "@/features/typing/server/answer-check";
import { selectCardsByPriority } from "@/features/learning-modes/types";
import {
  completeLearningCoverageSession,
  loadAppearanceCounts,
  loadWrongAnswerCardIds,
} from "@/features/practice-coverage/server/actions";
import { fetchStudyCards } from "@/features/study/server/load-study-cards";
import { seededShuffle } from "@/features/study/utils/shuffle";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const generic = "Không thể xử lý bài kiểm tra. Vui lòng thử lại.";
const TYPING_QUICK_COUNTS = [10, 20, 30, 50];

async function authenticatedUserId(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string | null> {
  const { data } = await supabase.auth.getClaims();
  const subject = data?.claims?.sub;
  return typeof subject === "string" && subject.length > 0 ? subject : null;
}

type Source = { all: boolean; setIds: string[]; collectionIds: string[] };

function buildAvailableCounts(total: number): number[] {
  return [
    ...TYPING_QUICK_COUNTS.filter((value) => value < total),
    ...(total >= TYPING_MIN_QUESTIONS && total <= TYPING_MAX_QUESTIONS ? [total] : []),
  ];
}

export type TypingAvailabilityResult =
  { ok: true; availability: TypingAvailability } | { ok: false; error: string };

/** Reports the eligible pool size and the selectable question counts. */
export async function getTypingAvailability(input: unknown): Promise<TypingAvailabilityResult> {
  const parsed = typingSourceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? generic };

  const supabase = await createClient();
  if (!(await authenticatedUserId(supabase)))
    return { ok: false, error: "Phiên đăng nhập đã hết hạn." };

  try {
    const { cards } = await fetchStudyCards(supabase, parsed.data);
    return {
      ok: true,
      availability: {
        eligibleCount: cards.length,
        availableCounts: buildAvailableCounts(cards.length),
      },
    };
  } catch {
    return { ok: false, error: "Không thể tải thẻ lúc này." };
  }
}

export type StartTypingResult =
  { ok: true; session: StartedTypingSession } | { ok: false; error: string };

export async function startTypingSession(input: unknown): Promise<StartTypingResult> {
  const parsed = typingStartSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? generic };

  const supabase = await createClient();
  const userId = await authenticatedUserId(supabase);
  if (!userId) return { ok: false, error: "Phiên đăng nhập đã hết hạn." };

  try {
    const source: Source = {
      all: parsed.data.all,
      setIds: parsed.data.setIds,
      collectionIds: parsed.data.collectionIds,
    };
    const { cards } = await fetchStudyCards(supabase, source);
    const availableCounts = buildAvailableCounts(cards.length);
    if (!availableCounts.includes(parsed.data.questionCount)) {
      return {
        ok: false,
        error:
          cards.length < TYPING_MIN_QUESTIONS
            ? `Cần tối thiểu ${TYPING_MIN_QUESTIONS} thẻ — phạm vi hiện có ${cards.length} thẻ`
            : "Không thể tạo phiên kiểm tra với số câu này.",
      };
    }

    const pool = cards.map((card) => card.id);
    const shuffled = seededShuffle(pool, randomInt(0, 2 ** 32));
    const [appearance, wrong] = await Promise.all([
      loadAppearanceCounts("typing", shuffled),
      loadWrongAnswerCardIds(shuffled),
    ]);
    const selectedIds = selectCardsByPriority(
      shuffled,
      wrong,
      appearance,
      parsed.data.questionCount,
    );
    const cardById = new Map(cards.map((card) => [card.id, card]));
    const selectedCards: TypingCard[] = selectedIds.flatMap((id) => {
      const card = cardById.get(id);
      return card ? [{ id: card.id, front: card.front, back: card.back }] : [];
    });
    if (selectedCards.length !== parsed.data.questionCount) {
      return { ok: false, error: "Không đủ thẻ để tạo bài kiểm tra." };
    }

    const admin = createAdminClient();
    const { data: coverageSessionId, error } = await admin.rpc("create_learning_coverage_session", {
      p_user_id: userId,
      p_mode: "typing",
      p_session_card_ids: selectedCards.map((card) => card.id),
      p_scope_card_ids: pool,
    });
    if (error || !coverageSessionId) throw new Error("coverage session creation failed");

    return {
      ok: true,
      session: {
        coverageSessionId,
        cards: selectedCards,
        selectedCount: selectedCards.length,
        eligibleCount: cards.length,
      },
    };
  } catch {
    return { ok: false, error: "Không thể tạo bài kiểm tra lúc này." };
  }
}

export type SubmitTypingResult =
  { ok: true; result: TypingSubmitResult; saveError: string | null } | { ok: false; error: string };

export async function submitTypingAttempt(input: unknown): Promise<SubmitTypingResult> {
  const parsed = submitTypingAttemptSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? generic };

  const supabase = await createClient();
  const userId = await authenticatedUserId(supabase);
  if (!userId) return { ok: false, error: "Phiên đăng nhập đã hết hạn." };

  try {
    // Load the correct answers (backs) for the submitted cards. RLS limits
    // this to the user's own cards, so a tampered flashcard id yields nothing.
    const cardIds = parsed.data.answers.map((answer) => answer.flashcardId);
    const { data: cards, error: cardsError } = await supabase
      .from("flashcards")
      .select("id, front, back, set_id")
      .in("id", cardIds);
    if (cardsError || (cards ?? []).length !== cardIds.length) {
      return { ok: false, error: "Một số thẻ không còn tồn tại." };
    }
    const backById = new Map((cards ?? []).map((card) => [card.id, card.back]));

    // Grade server-side, two steps: local matching first, then the AI reviewer
    // only for answers the local matcher marks wrong. Answers are graded in
    // order (one AI call per wrong answer) to stay within provider limits.
    const questions = [];
    let correctCount = 0;
    for (const answer of parsed.data.answers) {
      const back = backById.get(answer.flashcardId) ?? "";
      const isCorrect = await gradeTypingAnswer(answer.answer, back);
      if (isCorrect) correctCount += 1;
      const card = (cards ?? []).find((item) => item.id === answer.flashcardId);
      questions.push({
        flashcardId: answer.flashcardId,
        setId: card?.set_id ?? "",
        front: card?.front ?? "",
        back,
        userAnswer: answer.answer,
        isCorrect,
      });
    }

    // Coverage completion failure is non-blocking: the attempt and per-card
    // events are still recorded and the result screen is shown with a warning.
    const coverage = await completeLearningCoverageSession(parsed.data.coverageSessionId);

    const save = await saveTypingResult({
      coverageSessionId: parsed.data.coverageSessionId,
      sourceSetIds: parsed.data.sourceSetIds,
      sourceCollectionIds: parsed.data.sourceCollectionIds,
      sourceAll: parsed.data.sourceAll,
      totalQuestions: parsed.data.totalQuestions,
      correctCount,
      elapsedMs: parsed.data.elapsedMs,
      answers: questions.map((question) => ({
        flashcardId: question.flashcardId,
        isCorrect: question.isCorrect,
      })),
    });

    const wrongCardIds = questions
      .filter((question) => !question.isCorrect)
      .map((question) => question.flashcardId);

    let collections: Array<{ id: string; name: string }> = [];
    let membershipsByCard: Record<string, string[]> = {};
    if (wrongCardIds.length > 0) {
      const [collectionsResult, membershipsResult] = await Promise.all([
        supabase.from("special_collections").select("id, name").order("name", { ascending: true }),
        supabase
          .from("special_collection_items")
          .select("collection_id, flashcard_id")
          .in("flashcard_id", wrongCardIds),
      ]);
      collections = (collectionsResult.data ?? []).map((collection) => ({
        id: collection.id,
        name: collection.name,
      }));
      membershipsByCard = {};
      for (const item of membershipsResult.data ?? []) {
        (membershipsByCard[item.flashcard_id] ??= []).push(item.collection_id);
      }
    }

    return {
      ok: true,
      result: {
        correctCount,
        totalCount: parsed.data.totalQuestions,
        questions,
        collections,
        membershipsByCard,
      },
      saveError: !coverage.ok ? coverage.error : save.ok ? null : save.error,
    };
  } catch {
    return { ok: false, error: "Không thể chấm điểm bài kiểm tra lúc này." };
  }
}

export type RetrySaveResult = { ok: true } | { ok: false; error: string };

/** Re-saves a graded typing attempt without re-running the AI reviewer. */
export async function retryTypingSave(input: unknown): Promise<RetrySaveResult> {
  const parsed = retryTypingSaveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? generic };

  const supabase = await createClient();
  const userId = await authenticatedUserId(supabase);
  if (!userId) return { ok: false, error: "Phiên đăng nhập đã hết hạn." };

  try {
    const coverage = await completeLearningCoverageSession(parsed.data.coverageSessionId);
    if (!coverage.ok) return { ok: false, error: coverage.error };

    const save = await saveTypingResult({
      coverageSessionId: parsed.data.coverageSessionId,
      sourceSetIds: parsed.data.sourceSetIds,
      sourceCollectionIds: parsed.data.sourceCollectionIds,
      sourceAll: parsed.data.sourceAll,
      totalQuestions: parsed.data.totalQuestions,
      correctCount: parsed.data.correctCount,
      elapsedMs: parsed.data.elapsedMs,
      answers: parsed.data.answers,
    });
    return save;
  } catch {
    return { ok: false, error: "Không thể lưu kết quả lúc này." };
  }
}

async function saveTypingResult(input: {
  coverageSessionId: string;
  sourceSetIds: string[];
  sourceCollectionIds: string[];
  sourceAll: boolean;
  totalQuestions: number;
  correctCount: number;
  elapsedMs: number;
  answers: Array<{ flashcardId: string; isCorrect: boolean }>;
}): Promise<RetrySaveResult> {
  const supabase = await createClient();
  const userId = await authenticatedUserId(supabase);
  if (!userId) return { ok: false, error: "Phiên đăng nhập đã hết hạn." };

  const admin = createAdminClient();
  const { error: saveError } = await admin.rpc("save_typing_attempt", {
    p_user_id: userId,
    p_source_set_ids: input.sourceSetIds,
    p_source_collection_ids: input.sourceCollectionIds,
    p_source_all: input.sourceAll,
    p_total_questions: input.totalQuestions,
    p_correct_questions: input.correctCount,
    p_elapsed_ms: input.elapsedMs,
  });
  if (saveError) return { ok: false, error: "Không thể lưu kết quả lúc này." };

  const { error: eventsError } = await admin.rpc("record_mode_answers", {
    p_user_id: userId,
    p_mode: "typing",
    p_answers: input.answers.map((answer) => ({
      flashcard_id: answer.flashcardId,
      is_correct: answer.isCorrect,
    })),
  });
  if (eventsError) return { ok: false, error: "Không thể lưu kết quả lúc này." };

  return { ok: true };
}
