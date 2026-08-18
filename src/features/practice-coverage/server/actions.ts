"use server";

import { z } from "zod";

import type { CoverageMode } from "../constants";
import { createClient } from "@/lib/supabase/server";

const coverageSessionIdSchema = z.uuid();
const COVERAGE_ID_BATCH_SIZE = 200;
const WRONG_ANSWER_PAGE_SIZE = 1000;

/**
 * Reads the authenticated user's per-card appearance count summed across a
 * mode group (quiz/match/typing or memory/runner): a card that appeared in
 * several modes of the group contributes the total of its appearance counts.
 */
export async function loadAppearanceCounts(
  modes: readonly CoverageMode[],
  eligibleIds: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (eligibleIds.length === 0) return counts;
  const supabase = await createClient();
  const chunks = Array.from(
    { length: Math.ceil(eligibleIds.length / COVERAGE_ID_BATCH_SIZE) },
    (_, index) =>
      eligibleIds.slice(index * COVERAGE_ID_BATCH_SIZE, (index + 1) * COVERAGE_ID_BATCH_SIZE),
  );
  const results = await Promise.all(
    chunks.map((ids) =>
      supabase
        .from("flashcard_coverage")
        .select("flashcard_id, appearance_count")
        .in("mode", [...modes])
        .in("flashcard_id", ids),
    ),
  );
  if (results.some((result) => result.error)) throw new Error("coverage query failed");
  for (const result of results) {
    for (const row of result.data ?? []) {
      if (row.flashcard_id) {
        counts.set(row.flashcard_id, (counts.get(row.flashcard_id) ?? 0) + row.appearance_count);
      }
    }
  }
  return counts;
}

/**
 * Reads the canonical shared wrong-answer history — the latest answered
 * record per card across ALL quiz modes (Quiz via quiz_questions, Match and
 * Typing via mode_answer_events) — without creating any history of its own.
 * A card is wrong only when its most recent answer is wrong, so "wrong then
 * correct" resolves to correct. Study modes reuse this set so their "Sai"
 * filter means the same thing everywhere.
 */
export async function loadWrongAnswerCardIds(eligibleIds: string[]): Promise<Set<string>> {
  if (eligibleIds.length === 0) return new Set();
  const supabase = await createClient();
  const chunks = Array.from(
    { length: Math.ceil(eligibleIds.length / COVERAGE_ID_BATCH_SIZE) },
    (_, index) =>
      eligibleIds.slice(index * COVERAGE_ID_BATCH_SIZE, (index + 1) * COVERAGE_ID_BATCH_SIZE),
  );
  const results = await Promise.all(chunks.map((ids) => loadLatestAnswers(supabase, ids)));
  const wrong = new Set<string>();
  for (const rows of results) {
    const seen = new Set<string>();
    // Rows arrive ordered by (answered_at desc, id desc) — the first row for
    // each card is its latest answer across every mode.
    for (const row of rows) {
      if (!row.flashcard_id || seen.has(row.flashcard_id)) continue;
      seen.add(row.flashcard_id);
      if (row.is_correct === false) wrong.add(row.flashcard_id);
    }
  }
  return wrong;
}

type AnswerRow = {
  id: string;
  flashcard_id: string | null;
  is_correct: boolean | null;
  answered_at: string | null;
};

async function loadLatestAnswers(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ids: string[],
): Promise<AnswerRow[]> {
  const [quizRows, modeRows] = await Promise.all([
    loadCompletedQuizAnswers(supabase, ids),
    loadModeAnswerEvents(supabase, ids),
  ]);
  // Merge both sources and sort so the newest record per card wins the
  // latest-answer rule regardless of which mode produced it.
  return [...quizRows, ...modeRows].sort((a, b) => {
    const timeDiff = (b.answered_at ?? "").localeCompare(a.answered_at ?? "");
    return timeDiff !== 0 ? timeDiff : b.id.localeCompare(a.id);
  });
}

async function loadCompletedQuizAnswers(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ids: string[],
) {
  const rows: AnswerRow[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("quiz_questions")
      .select("id, flashcard_id, is_correct, answered_at, quiz_sessions!inner(completed_at)")
      .in("flashcard_id", ids)
      .not("answered_at", "is", null)
      .not("quiz_sessions.completed_at", "is", null)
      .order("answered_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, from + WRONG_ANSWER_PAGE_SIZE - 1);
    if (error) throw new Error("wrong-answer query failed");

    rows.push(...(data ?? []));
    if ((data?.length ?? 0) < WRONG_ANSWER_PAGE_SIZE) return rows;
    from += WRONG_ANSWER_PAGE_SIZE;
  }
}

async function loadModeAnswerEvents(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ids: string[],
) {
  const rows: AnswerRow[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("mode_answer_events")
      .select("id, flashcard_id, is_correct, answered_at")
      .in("flashcard_id", ids)
      .order("answered_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, from + WRONG_ANSWER_PAGE_SIZE - 1);
    if (error) throw new Error("wrong-answer query failed");

    rows.push(...(data ?? []));
    if ((data?.length ?? 0) < WRONG_ANSWER_PAGE_SIZE) return rows;
    from += WRONG_ANSWER_PAGE_SIZE;
  }
}

/**
 * Completion accepts only an opaque, server-created session identity.  The
 * database owns all card/scope snapshots and serializes the coverage reset.
 */
export async function completeLearningCoverageSession(
  sessionId: string,
): Promise<{ ok: true; didReset: boolean } | { ok: false; error: string }> {
  if (!coverageSessionIdSchema.safeParse(sessionId).success) {
    return { ok: false, error: "Phiên luyện tập không hợp lệ." };
  }

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (typeof claims?.claims?.sub !== "string") {
    return { ok: false, error: "Phiên đăng nhập đã hết hạn." };
  }

  const { data, error } = await supabase.rpc("complete_learning_coverage_session", {
    p_session_id: sessionId,
  });
  if (error || !data?.[0]) {
    return { ok: false, error: "Không thể hoàn tất phạm vi luyện tập lúc này." };
  }

  return { ok: true, didReset: Boolean(data[0].did_reset) };
}
