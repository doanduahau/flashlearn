"use server";

import { randomInt } from "node:crypto";

import { matchStartSchema } from "@/features/match/schemas/match-schema";
import type { MatchCard, StartedMatchSession } from "@/features/match/types/match-types";
import {
  buildMatchSession,
  createSeededMatchRandom,
  getMatchEligibility,
} from "@/features/match/utils/match-session";
import { priorityIdsForFilter } from "@/features/learning-modes/types";
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
      hasUncovered: boolean;
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
    const uncovered = await loadUncoveredIds(
      "match",
      cards.map((card) => card.id),
    );
    const eligibility = getMatchEligibility(cards);
    return {
      ok: true,
      eligibleCount: cards.length,
      eligibility: { availableCounts: eligibility.availableCounts, message: eligibility.message },
      hasUncovered: uncovered.length > 0,
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

    const uncovered = new Set(
      await loadUncoveredIds(
        "match",
        cards.map((card) => card.id),
      ),
    );
    const wrong = await loadWrongAnswerCardIds(cards.map((card) => card.id));
    const priority = priorityIdsForFilter(parsed.data.filter, uncovered, wrong);
    const batches = buildMatchSession(
      cards,
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
      p_scope_card_ids: cards.map((card) => card.id),
      p_quiz_session_id: null,
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
