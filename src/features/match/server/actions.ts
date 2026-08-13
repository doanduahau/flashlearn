"use server";

import { randomInt } from "node:crypto";

import { matchStartSchema } from "@/features/match/schemas/match-schema";
import type { MatchCard, StartedMatchSession } from "@/features/match/types/match-types";
import {
  buildMatchSession,
  createSeededMatchRandom,
  getMatchEligibility,
} from "@/features/match/utils/match-session";
import { applyLearningFilter } from "@/features/learning-modes/types";
import {
  loadUncoveredIds,
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
    const filtered = await filterCardsByMode(cards, parsed.data.filter);
    const eligibility = getMatchEligibility(filtered);
    return {
      ok: true,
      eligibleCount: filtered.length,
      eligibility: { availableCounts: eligibility.availableCounts, message: eligibility.message },
    };
  } catch {
    return { ok: false, error: "Không thể tải thẻ Match lúc này." };
  }
}

/**
 * Strict pool filtering: unseen/wrong never backfill with covered/never-wrong
 * cards. Random keeps the whole valid pool and is only coverage-aware during
 * selection.
 */
async function filterCardsByMode(
  cards: MatchCard[],
  filter: "unseen" | "wrong" | "random",
): Promise<MatchCard[]> {
  const allIds = cards.map((card) => card.id);
  const uncovered = new Set(await loadUncoveredIds("match", allIds));
  const wrong = await loadWrongAnswerCardIds(allIds);
  const eligibleIds = new Set(applyLearningFilter(filter, allIds, uncovered, wrong));
  return cards.filter((card) => eligibleIds.has(card.id));
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
    const filtered = await filterCardsByMode(cards, parsed.data.filter);
    const eligibility = getMatchEligibility(filtered);
    if (!eligibility.availableCounts.includes(parsed.data.questionCount)) {
      return {
        ok: false,
        error: eligibility.message ?? "Không thể tạo phiên Match với số câu này.",
      };
    }

    // Random keeps the whole pool but stays coverage-aware; unseen/wrong are
    // already strict so their selection needs no priority.
    const priority =
      parsed.data.filter === "random"
        ? new Set(
            await loadUncoveredIds(
              "match",
              filtered.map((card) => card.id),
            ),
          )
        : undefined;
    const batches = buildMatchSession(
      filtered,
      parsed.data.questionCount,
      createSeededMatchRandom(randomInt(0, 2 ** 32)),
      priority,
    );
    if (!batches) return { ok: false, error: "Không thể tạo phiên Match với phạm vi hiện tại." };

    const sessionCardIds = batches.flatMap((batch) => batch.fronts.map((card) => card.id));
    const admin = createAdminClient();
    const { data: coverageSessionId, error } = await admin.rpc("create_learning_coverage_session", {
      p_user_id: userId,
      p_mode: "match",
      p_session_card_ids: sessionCardIds,
      p_scope_card_ids: filtered.map((card) => card.id),
      p_quiz_session_id: null,
    });
    if (error || !coverageSessionId) throw new Error("coverage session creation failed");

    return {
      ok: true,
      session: {
        coverageSessionId,
        batches,
        selectedCount: sessionCardIds.length,
        eligibleCount: filtered.length,
      },
    };
  } catch {
    return { ok: false, error: "Không thể tạo phiên Match lúc này." };
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
