"use server";

import { randomInt } from "node:crypto";

import { memoryStartSchema } from "@/features/memory/schemas/memory-schema";
import type { MemoryCard, StartedMemorySession } from "@/features/memory/types/memory-types";
import { buildMemorySession, getMemoryEligibility } from "@/features/memory/utils/memory-session";
import { STUDY_COVERAGE_MODES } from "@/features/practice-coverage/constants";
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

export type MemoryAvailabilityResult =
  | {
      ok: true;
      eligibleCount: number;
      eligibility: { availableCounts: number[]; message: string | null };
    }
  | { ok: false; error: string };

export async function getMemoryAvailability(input: unknown): Promise<MemoryAvailabilityResult> {
  const parsed = memoryStartSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };

  const supabase = await createClient();
  if (!(await authenticatedUserId(supabase)))
    return { ok: false, error: "Phiên đăng nhập đã hết hạn." };

  try {
    const cards = await loadCards(supabase, parsed.data);
    const eligibility = getMemoryEligibility(cards);
    return {
      ok: true,
      eligibleCount: cards.length,
      eligibility,
    };
  } catch {
    return { ok: false, error: "Không thể tải thẻ Memory lúc này." };
  }
}

/**
 * Reads the shared priority inputs without changing coverage. Session creation
 * chooses latest-wrong cards first, then the least-appeared cards.
 */
async function loadPriorityIds(cards: MemoryCard[]): Promise<{
  wrong: Set<string>;
  appearance: Map<string, number>;
}> {
  const allIds = cards.map((card) => card.id);
  const [appearance, wrong] = await Promise.all([
    loadAppearanceCounts(STUDY_COVERAGE_MODES, allIds),
    loadWrongAnswerCardIds(allIds),
  ]);
  return { wrong, appearance };
}

export async function startMemoryCoverageSession(
  input: unknown,
): Promise<{ ok: true; session: StartedMemorySession } | { ok: false; error: string }> {
  const parsed = memoryStartSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };

  const supabase = await createClient();
  const userId = await authenticatedUserId(supabase);
  if (!userId) return { ok: false, error: "Phiên đăng nhập đã hết hạn." };

  try {
    const cards = await loadCards(supabase, parsed.data);
    const eligibility = getMemoryEligibility(cards);
    if (!eligibility.availableCounts.includes(parsed.data.questionCount)) {
      return {
        ok: false,
        error: eligibility.message ?? "Không thể tạo phiên Memory với số câu này.",
      };
    }

    const priority = await loadPriorityIds(cards);
    const priorityRanks = new Map(
      cards.map((card) => [
        card.id,
        priority.wrong.has(card.id) ? -1 : (priority.appearance.get(card.id) ?? 0),
      ]),
    );
    const batches = buildMemorySession(
      cards,
      parsed.data.questionCount,
      () => randomInt(0, 2 ** 32) / 2 ** 32,
      priorityRanks,
    );
    if (!batches) return { ok: false, error: "Không thể tạo phiên Memory với phạm vi hiện tại." };

    const sessionCardIds = batches.flatMap((batch) =>
      batch.tiles.filter((tile) => tile.side === "front").map((tile) => tile.cardId),
    );
    const admin = createAdminClient();
    const { data: coverageSessionId, error } = await admin.rpc("create_learning_coverage_session", {
      p_user_id: userId,
      p_mode: "memory",
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
    return { ok: false, error: "Không thể tạo phiên Memory lúc này." };
  }
}

async function loadCards(
  supabase: Awaited<ReturnType<typeof createClient>>,
  source: { all: boolean; setIds: string[]; collectionIds: string[] },
): Promise<MemoryCard[]> {
  let rows: { id: string; front: string; back: string }[] = [];
  if (source.all) {
    const { data, error } = await supabase
      .from("flashcards")
      .select("id, front, back")
      .order("set_id", { ascending: true })
      .order("position", { ascending: true });
    if (error) throw new Error("memory card query failed");
    rows = data ?? [];
  } else {
    if (source.setIds.length) {
      const { data: sources, error: sourceError } = await supabase
        .from("flashcard_sets")
        .select("id")
        .in("id", source.setIds);
      if (sourceError || (sources ?? []).length !== source.setIds.length) {
        throw new Error("memory source ownership failed");
      }
      const { data, error } = await supabase
        .from("flashcards")
        .select("id, front, back")
        .in("set_id", source.setIds)
        .order("set_id", { ascending: true })
        .order("position", { ascending: true });
      if (error) throw new Error("memory set card query failed");
      rows.push(...(data ?? []));
    }
    if (source.collectionIds.length) {
      const { data: sources, error: sourceError } = await supabase
        .from("special_collections")
        .select("id")
        .in("id", source.collectionIds);
      if (sourceError || (sources ?? []).length !== source.collectionIds.length) {
        throw new Error("memory source ownership failed");
      }
      const { data, error } = await supabase
        .from("special_collection_items")
        .select("flashcard_id, flashcards(id, front, back)")
        .in("collection_id", source.collectionIds);
      if (error) throw new Error("memory collection card query failed");
      rows.push(
        ...(data ?? [])
          .map((item) => item.flashcards)
          .filter((card): card is { id: string; front: string; back: string } => card !== null),
      );
    }
  }

  const seen = new Set<string>();
  return rows.flatMap((row) => {
    if (seen.has(row.id)) return [];
    seen.add(row.id);
    return [{ id: row.id, front: row.front, back: row.back }];
  });
}
