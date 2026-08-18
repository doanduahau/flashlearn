"use server";

import { randomInt } from "node:crypto";

import { matchStartSchema, saveMatchAttemptSchema } from "@/features/match/schemas/match-schema";
import type { MatchCard, StartedMatchSession } from "@/features/match/types/match-types";
import {
  buildMatchSession,
  createSeededMatchRandom,
  getMatchEligibility,
  shuffle,
} from "@/features/match/utils/match-session";
import { selectCardsByPriority } from "@/features/learning-modes/types";
import { QUIZ_COVERAGE_MODES } from "@/features/practice-coverage/constants";
import {
  loadAppearanceCounts,
  loadWrongAnswerCardIds,
} from "@/features/practice-coverage/server/actions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function authenticatedUserId(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string | null> {
  const { data } = await supabase.auth.getClaims();
  return typeof data?.claims?.sub === "string" ? data.claims.sub : null;
}

export type MatchAvailabilityResult =
  | {
      ok: true;
      eligibleCount: number;
      eligibility: { availableCounts: number[]; message: string | null };
    }
  | { ok: false; error: string };

export async function getMatchAvailability(input: unknown): Promise<MatchAvailabilityResult> {
  const parsed = matchStartSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };

  const supabase = await createClient();
  if (!(await authenticatedUserId(supabase)))
    return { ok: false, error: "Phiên đăng nhập đã hết hạn." };

  try {
    const cards = await loadCards(supabase, parsed.data);
    const eligibility = getMatchEligibility(cards);
    return {
      ok: true,
      eligibleCount: cards.length,
      eligibility: { availableCounts: eligibility.availableCounts, message: eligibility.message },
    };
  } catch {
    return { ok: false, error: "Không thể tải thẻ Match lúc này." };
  }
}

export async function startMatchCoverageSession(
  input: unknown,
): Promise<{ ok: true; session: StartedMatchSession } | { ok: false; error: string }> {
  const parsed = matchStartSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };

  const supabase = await createClient();
  const userId = await authenticatedUserId(supabase);
  if (!userId) return { ok: false, error: "Phiên đăng nhập đã hết hạn." };

  try {
    const cards = await loadCards(supabase, parsed.data);
    const eligibility = getMatchEligibility(cards);
    if (!eligibility.availableCounts.includes(parsed.data.questionCount)) {
      return {
        ok: false,
        error: eligibility.message ?? "Không thể tạo phiên Match với số câu này.",
      };
    }

    const random = createSeededMatchRandom(randomInt(0, 2 ** 32));
    const shuffled = shuffle(cards, random);
    const poolIds = shuffled.map((card) => card.id);
    const [appearance, wrong] = await Promise.all([
      loadAppearanceCounts(QUIZ_COVERAGE_MODES, poolIds),
      loadWrongAnswerCardIds(poolIds),
    ]);
    const selectedIds = selectCardsByPriority(
      poolIds,
      wrong,
      appearance,
      parsed.data.questionCount,
    );
    const cardById = new Map(cards.map((card) => [card.id, card]));
    const selectedCards = selectedIds.flatMap((id) => {
      const card = cardById.get(id);
      return card ? [card] : [];
    });
    const batches = buildMatchSession(selectedCards, parsed.data.questionCount, random);
    if (!batches) return { ok: false, error: "Không thể tạo phiên Match với phạm vi hiện tại." };

    const sessionCardIds = batches.flatMap((batch) => batch.fronts.map((card) => card.id));
    const admin = createAdminClient();
    const { data: coverageSessionId, error } = await admin.rpc("create_learning_coverage_session", {
      p_user_id: userId,
      p_mode: "match",
      p_session_card_ids: sessionCardIds,
      p_scope_card_ids: cards.map((card) => card.id),
    });
    if (error || !coverageSessionId) throw new Error("coverage session creation failed");

    return {
      ok: true,
      session: {
        coverageSessionId,
        batches,
        selectedCount: sessionCardIds.length,
        eligibleCount: cards.length,
      },
    };
  } catch {
    return { ok: false, error: "Không thể tạo phiên Match lúc này." };
  }
}

export type SaveMatchAttemptResult = { ok: true } | { ok: false; error: string };

export async function saveMatchAttempt(input: unknown): Promise<SaveMatchAttemptResult> {
  const parsed = saveMatchAttemptSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };

  const supabase = await createClient();
  const userId = await authenticatedUserId(supabase);
  if (!userId) return { ok: false, error: "Phiên đăng nhập đã hết hạn." };

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("save_match_attempt", {
      p_user_id: userId,
      p_source_set_ids: parsed.data.sourceSetIds,
      p_source_collection_ids: parsed.data.sourceCollectionIds,
      p_source_all: parsed.data.sourceAll,
      p_total_pairs: parsed.data.totalPairs,
      p_correct_pair_count: parsed.data.correctPairs,
      p_incorrect_attempt_count: parsed.data.incorrectAttempts,
      p_elapsed_ms: parsed.data.elapsedMs,
    });
    if (error || typeof data !== "string" || data.length === 0) {
      return { ok: false, error: "Không thể lưu kết quả lúc này." };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Không thể lưu kết quả lúc này." };
  }
}

async function loadCards(
  supabase: Awaited<ReturnType<typeof createClient>>,
  source: { all: boolean; setIds: string[]; collectionIds: string[] },
): Promise<MatchCard[]> {
  let rows: { id: string; front: string; back: string }[] = [];
  if (source.all) {
    const { data, error } = await supabase
      .from("flashcards")
      .select("id, front, back")
      .order("set_id", { ascending: true })
      .order("position", { ascending: true });
    if (error) throw new Error("match card query failed");
    rows = data ?? [];
  } else if (source.setIds.length) {
    const { data: sources, error: sourceError } = await supabase
      .from("flashcard_sets")
      .select("id")
      .in("id", source.setIds);
    if (sourceError || (sources ?? []).length !== source.setIds.length) {
      throw new Error("match source ownership failed");
    }
    const { data, error } = await supabase
      .from("flashcards")
      .select("id, front, back")
      .in("set_id", source.setIds)
      .order("set_id", { ascending: true })
      .order("position", { ascending: true });
    if (error) throw new Error("match set card query failed");
    rows = data ?? [];
  } else {
    const { data: sources, error: sourceError } = await supabase
      .from("special_collections")
      .select("id")
      .in("id", source.collectionIds);
    if (sourceError || (sources ?? []).length !== source.collectionIds.length) {
      throw new Error("match source ownership failed");
    }
    const { data, error } = await supabase
      .from("special_collection_items")
      .select("flashcard_id, flashcards(id, front, back)")
      .in("collection_id", source.collectionIds);
    if (error) throw new Error("match collection card query failed");
    rows = (data ?? [])
      .map((item) => item.flashcards)
      .filter((card): card is { id: string; front: string; back: string } => card !== null);
  }

  const seen = new Set<string>();
  return rows.flatMap((row) => {
    if (seen.has(row.id)) return [];
    seen.add(row.id);
    return [{ id: row.id, front: row.front, back: row.back }];
  });
}
