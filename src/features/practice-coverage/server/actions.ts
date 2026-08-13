"use server";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

type CoverageMode = "quiz" | "match" | "memory" | "runner";

const coverageSessionIdSchema = z.uuid();
const COVERAGE_ID_BATCH_SIZE = 200;

/** Reads only the authenticated user's current-cycle coverage. */
export async function loadUncoveredIds(
  mode: CoverageMode,
  eligibleIds: string[],
): Promise<string[]> {
  if (eligibleIds.length === 0) return [];
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
        .select("flashcard_id")
        .eq("mode", mode)
        .in("flashcard_id", ids),
    ),
  );
  if (results.some((result) => result.error)) throw new Error("coverage query failed");
  const covered = new Set(
    results.flatMap((result) => result.data ?? []).map((row) => row.flashcard_id),
  );
  return eligibleIds.filter((id) => !covered.has(id));
}

/**
 * Reads the canonical shared wrong-answer history — completed Quiz sessions'
 * incorrect answers — without creating any history of its own. Match and
 * Memory reuse this same set so their "Sai" filter means exactly what Quiz's
 * wrong-answer mode means.
 */
export async function loadWrongAnswerCardIds(eligibleIds: string[]): Promise<Set<string>> {
  if (eligibleIds.length === 0) return new Set();
  const supabase = await createClient();
  const chunks = Array.from(
    { length: Math.ceil(eligibleIds.length / COVERAGE_ID_BATCH_SIZE) },
    (_, index) =>
      eligibleIds.slice(index * COVERAGE_ID_BATCH_SIZE, (index + 1) * COVERAGE_ID_BATCH_SIZE),
  );
  const results = await Promise.all(
    chunks.map((ids) =>
      supabase
        .from("quiz_questions")
        .select("flashcard_id, quiz_sessions(completed_at)")
        .eq("is_correct", false)
        .in("flashcard_id", ids),
    ),
  );
  if (results.some((result) => result.error)) throw new Error("wrong-answer query failed");
  const wrong = new Set<string>();
  for (const result of results) {
    for (const row of result.data ?? []) {
      if (!row.flashcard_id) continue;
      const session = Array.isArray(row.quiz_sessions) ? row.quiz_sessions[0] : row.quiz_sessions;
      if (session && session.completed_at !== null) wrong.add(row.flashcard_id);
    }
  }
  return wrong;
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
