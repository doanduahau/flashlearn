"use server";

import { matchStartSchema } from "@/features/match/schemas/match-schema";
import type { MatchCard } from "@/features/match/types/match-types";
import { loadUncoveredIds } from "@/features/practice-coverage/server/actions";
import { collectStudyCardIds } from "@/features/study/server/load-study-cards";
import { createClient } from "@/lib/supabase/server";

async function authenticatedUserId(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string | null> {
  const { data } = await supabase.auth.getClaims();
  return typeof data?.claims?.sub === "string" ? data.claims.sub : null;
}

function eligibilityFromCount(count: number): {
  availableCounts: number[];
  message: string | null;
} {
  if (count < 12)
    return { availableCounts: [], message: "Match yêu cầu ít nhất 12 thẻ có thể ghép rõ ràng." };
  if (count < 18) return { availableCounts: [12], message: null };
  if (count < 24) return { availableCounts: [12, 18], message: null };
  return { availableCounts: [12, 18, 24], message: null };
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
    const ids = await collectStudyCardIds(supabase, {
      all: parsed.data.all,
      setIds: parsed.data.setIds,
      collectionIds: parsed.data.collectionIds,
    });
    const uncovered = await loadUncoveredIds("match", ids);
    return {
      ok: true,
      eligibleCount: ids.length,
      eligibility: eligibilityFromCount(ids.length),
      hasUncovered: uncovered.length > 0,
    };
  } catch {
    return { ok: false, error: "Không thể tải thẻ Match lúc này." };
  }
}

export async function loadMatchCards(
  input: unknown,
): Promise<{ ok: true; cards: MatchCard[] } | { ok: false; error: string }> {
  const parsed = matchStartSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };

  const supabase = await createClient();
  const userId = await authenticatedUserId(supabase);
  if (!userId) return { ok: false, error: "Phiên đăng nhập đã hết hạn." };

  try {
    const cards = await loadCards(supabase, parsed.data);
    return { ok: true, cards };
  } catch {
    return { ok: false, error: "Không thể tải thẻ Match lúc này." };
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
  } else {
    if (source.setIds.length) {
      const { data, error } = await supabase
        .from("flashcards")
        .select("id, front, back")
        .in("set_id", source.setIds)
        .order("set_id", { ascending: true })
        .order("position", { ascending: true });
      if (error) throw new Error("match set card query failed");
      rows.push(...(data ?? []));
    }
    if (source.collectionIds.length) {
      const { data, error } = await supabase
        .from("special_collection_items")
        .select("flashcard_id, flashcards(id, front, back)")
        .in("collection_id", source.collectionIds);
      if (error) throw new Error("match collection card query failed");
      rows.push(
        ...(data ?? [])
          .map((item) => item.flashcards)
          .filter((card): card is { id: string; front: string; back: string } => card !== null),
      );
    }
  }

  const seen = new Set<string>();
  const cards: MatchCard[] = [];
  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    cards.push({ id: row.id, front: row.front, back: row.back });
  }

  // Reorder: uncovered cards first for the session builder to prioritize.
  const eligibleIds = cards.map((c) => c.id);
  const uncovered = await loadUncoveredIds("match", eligibleIds);
  const uncoveredSet = new Set(uncovered);
  const uncoveredCards = cards.filter((c) => uncoveredSet.has(c.id));
  const coveredCards = cards.filter((c) => !uncoveredSet.has(c.id));
  return [...uncoveredCards, ...coveredCards];
}
