"use server";

import { matchStartSchema } from "@/features/match/schemas/match-schema";
import type { MatchCard } from "@/features/match/types/match-types";
import { getMatchEligibility, type MatchEligibility } from "@/features/match/utils/match-session";
import { createClient } from "@/lib/supabase/server";

export type MatchAvailabilityResult =
  { ok: true; eligibleCount: number; eligibility: MatchEligibility } | { ok: false; error: string };

async function authenticatedUserId(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string | null> {
  const { data } = await supabase.auth.getClaims();
  return typeof data?.claims?.sub === "string" ? data.claims.sub : null;
}

export async function getMatchAvailability(input: unknown): Promise<MatchAvailabilityResult> {
  const parsed = matchStartSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };

  const supabase = await createClient();
  if (!(await authenticatedUserId(supabase)))
    return { ok: false, error: "Phiên đăng nhập đã hết hạn." };

  try {
    const cards = await loadCards(supabase, parsed.data);
    return { ok: true, eligibleCount: cards.length, eligibility: getMatchEligibility(cards) };
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
    return { ok: true, cards: await loadCards(supabase, parsed.data) };
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

  return cards;
}
