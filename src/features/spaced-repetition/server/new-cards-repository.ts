import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../../../lib/supabase/types";

type Supabase = SupabaseClient<Database>;

export type NewCardCandidate = {
  flashcardId: string;
  createdAt: string;
};

export type NewCardCandidateResult = {
  total: number;
  candidates: NewCardCandidate[];
};

const SCOPE_ID_PAGE_SIZE = 1000;
const IN_CLAUSE_BATCH_SIZE = 200;

async function loadScopeCardIds(supabase: Supabase, userId: string): Promise<string[]> {
  const ids: string[] = [];
  let start = 0;
  while (true) {
    const { data } = await supabase
      .from("flashcards")
      .select("id")
      .eq("user_id", userId)
      .order("id", { ascending: true })
      .range(start, start + SCOPE_ID_PAGE_SIZE - 1);
    const page = data ?? [];
    ids.push(...page.map((r: { id: string }) => r.id));
    if (page.length === 0) return ids;
    start += page.length;
  }
}

async function loadScheduledCardIds(supabase: Supabase, userId: string): Promise<Set<string>> {
  const ids = new Set<string>();
  let start = 0;
  while (true) {
    const { data } = await supabase
      .from("card_learning_schedule")
      .select("flashcard_id")
      .eq("user_id", userId)
      .range(start, start + SCOPE_ID_PAGE_SIZE - 1);
    const page = data ?? [];
    for (const r of page as Array<{ flashcard_id: string }>) {
      ids.add(r.flashcard_id);
    }
    if (page.length === 0) break;
    start += page.length;
  }
  return ids;
}

async function loadSchedulableEventCardIds(
  supabase: Supabase,
  userId: string,
): Promise<Set<string>> {
  const ids = new Set<string>();
  let start = 0;
  while (true) {
    const { data } = await supabase
      .from("card_review_events")
      .select("flashcard_id")
      .eq("user_id", userId)
      .or("fsrs_rating.gte.1,is_correct.not.is.null")
      .range(start, start + SCOPE_ID_PAGE_SIZE - 1);
    const page = data ?? [];
    for (const r of page as Array<{ flashcard_id: string }>) {
      ids.add(r.flashcard_id);
    }
    if (page.length === 0) break;
    start += page.length;
  }
  return ids;
}

export async function countNewCards(supabase: Supabase, userId: string): Promise<number> {
  const scopedIds = await loadScopeCardIds(supabase, userId);
  if (scopedIds.length === 0) return 0;

  const [scheduledIds, eventIds] = await Promise.all([
    loadScheduledCardIds(supabase, userId),
    loadSchedulableEventCardIds(supabase, userId),
  ]);

  let count = 0;
  for (const id of scopedIds) {
    if (!scheduledIds.has(id) && !eventIds.has(id)) count += 1;
  }
  return count;
}

export async function loadNewCardCandidateResult(
  supabase: Supabase,
  userId: string,
  limit?: number,
): Promise<NewCardCandidateResult> {
  const scopedIds = await loadScopeCardIds(supabase, userId);
  const scopedSet = new Set(scopedIds);
  if (scopedSet.size === 0) return { total: 0, candidates: [] };

  const [scheduledIds, eventIds] = await Promise.all([
    loadScheduledCardIds(supabase, userId),
    loadSchedulableEventCardIds(supabase, userId),
  ]);

  const excluded = new Set([...scheduledIds, ...eventIds]);
  const newIds = scopedIds.filter((id) => !excluded.has(id));

  if (newIds.length === 0) return { total: 0, candidates: [] };

  const createdAtMap = new Map<string, string>();
  for (let batch = 0; batch < newIds.length; batch += IN_CLAUSE_BATCH_SIZE) {
    const batchIds = newIds.slice(batch, batch + IN_CLAUSE_BATCH_SIZE);
    const { data } = await supabase.from("flashcards").select("id, created_at").in("id", batchIds);
    for (const r of data ?? []) {
      const row = r as { id: string; created_at: string };
      createdAtMap.set(row.id, row.created_at);
    }
  }

  const candidates: NewCardCandidate[] = newIds
    .filter((id) => createdAtMap.has(id))
    .map((id) => ({
      flashcardId: id,
      createdAt: createdAtMap.get(id) ?? "",
    }))
    .sort((a, b) => {
      const dateDiff = a.createdAt.localeCompare(b.createdAt);
      if (dateDiff !== 0) return dateDiff;
      return a.flashcardId.localeCompare(b.flashcardId);
    });

  const total = candidates.length;
  const limited = limit !== undefined ? candidates.slice(0, limit) : candidates;

  return { total, candidates: limited };
}
