"use server";

import { matchStartSchema } from "@/features/match/schemas/match-schema";
import type { MatchCard } from "@/features/match/types/match-types";
import { collectStudyCardIds } from "@/features/study/server/load-study-cards";
import { createClient } from "@/lib/supabase/server";

export type MatchCountResult = { ok: true; count: number } | { ok: false; error: string };

async function authenticatedUserId(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string | null> {
  const { data } = await supabase.auth.getClaims();
  return typeof data?.claims?.sub === "string" ? data.claims.sub : null;
}

export async function getMatchCardCount(input: unknown): Promise<MatchCountResult> {
  const parsed = matchStartSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };

  const supabase = await createClient();
  if (!(await authenticatedUserId(supabase)))
    return { ok: false, error: "Phiên đăng nhập đã hết hạn." };

  const ids = await collectStudyCardIds(supabase, {
    all: parsed.data.all,
    setIds: parsed.data.setIds,
    collectionIds: parsed.data.collectionIds,
  });

  return { ok: true, count: ids.length };
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

  let rows: { id: string; front: string; back: string }[] = [];
  if (parsed.data.all) {
    const { data } = await supabase
      .from("flashcards")
      .select("id, front, back")
      .order("set_id", { ascending: true })
      .order("position", { ascending: true });
    rows = data ?? [];
  } else {
    if (parsed.data.setIds.length) {
      const { data } = await supabase
        .from("flashcards")
        .select("id, front, back")
        .in("set_id", parsed.data.setIds)
        .order("set_id", { ascending: true })
        .order("position", { ascending: true });
      rows.push(...(data ?? []));
    }
    if (parsed.data.collectionIds.length) {
      const { data } = await supabase
        .from("special_collection_items")
        .select("flashcard_id, flashcards(id, front, back)")
        .in("collection_id", parsed.data.collectionIds);
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

  return { ok: true, cards };
}
