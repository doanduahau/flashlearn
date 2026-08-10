import type { SupabaseClient } from "@supabase/supabase-js";

import type { FsrsDueCandidate, FsrsDueScope } from "../types/due-types";
import type { Database } from "../../../lib/supabase/types";

type Supabase = SupabaseClient<Database>;

const SCOPE_ID_PAGE_SIZE = 1000;

export type { FsrsDueCandidate, FsrsDueScope } from "../types/due-types";

function toDueCandidate(row: {
  flashcard_id: string;
  due: string;
  last_review: string | null;
  state: number;
}): FsrsDueCandidate {
  return {
    flashcardId: row.flashcard_id,
    due: row.due,
    lastReview: row.last_review,
    state: row.state,
  };
}

async function findSetCardIds(
  supabase: Supabase,
  userId: string,
  setId: string,
): Promise<string[]> {
  const ids: string[] = [];
  let start = 0;
  while (true) {
    const { data, error } = await supabase
      .from("flashcards")
      .select("id")
      .eq("user_id", userId)
      .eq("set_id", setId)
      .order("id", { ascending: true })
      .range(start, start + SCOPE_ID_PAGE_SIZE - 1);
    if (error) throw new Error("Unable to load set flashcards for due candidates");
    const page = data ?? [];
    ids.push(...page.map((row) => row.id));
    if (page.length < SCOPE_ID_PAGE_SIZE) return ids;
    start += SCOPE_ID_PAGE_SIZE;
  }
}

async function findCollectionCardIds(
  supabase: Supabase,
  userId: string,
  collectionId: string,
): Promise<string[]> {
  const ids: string[] = [];
  let start = 0;
  while (true) {
    const { data, error } = await supabase
      .from("special_collection_items")
      .select("flashcard_id")
      .eq("user_id", userId)
      .eq("collection_id", collectionId)
      .order("flashcard_id", { ascending: true })
      .range(start, start + SCOPE_ID_PAGE_SIZE - 1);
    if (error) throw new Error("Unable to load collection flashcards for due candidates");
    const page = data ?? [];
    ids.push(...page.map((row) => row.flashcard_id));
    if (page.length < SCOPE_ID_PAGE_SIZE) return ids;
    start += SCOPE_ID_PAGE_SIZE;
  }
}

async function findScopedCardIds(
  supabase: Supabase,
  userId: string,
  scope: { type: "set"; setId: string } | { type: "collection"; collectionId: string },
): Promise<string[]> {
  if (scope.type === "set") return findSetCardIds(supabase, userId, scope.setId);
  return findCollectionCardIds(supabase, userId, scope.collectionId);
}

export async function countDueCards(
  supabase: Supabase,
  userId: string,
  scope: FsrsDueScope,
  evaluationTime: string,
): Promise<number> {
  let query = supabase
    .from("card_learning_schedule")
    .select("flashcard_id", { count: "exact", head: true })
    .eq("user_id", userId)
    .lte("due", evaluationTime);

  if (scope.type !== "library") {
    const cardIds = await findScopedCardIds(supabase, userId, scope);
    query = query.in("flashcard_id", cardIds);
  }

  const { count, error } = await query;
  if (error) throw new Error("Unable to count FSRS due cards");
  return count ?? 0;
}

export async function findDueCandidates(
  supabase: Supabase,
  userId: string,
  scope: FsrsDueScope,
  evaluationTime: string,
  limit?: number,
): Promise<FsrsDueCandidate[]> {
  let query = supabase
    .from("card_learning_schedule")
    .select("flashcard_id, due, last_review, state")
    .eq("user_id", userId)
    .lte("due", evaluationTime)
    .order("due", { ascending: true })
    .order("last_review", { ascending: true })
    .order("flashcard_id", { ascending: true });

  if (scope.type !== "library") {
    const cardIds = await findScopedCardIds(supabase, userId, scope);
    query = query.in("flashcard_id", cardIds);
  }

  if (limit !== undefined) {
    const normalized = Math.max(0, Math.floor(limit));
    query = query.limit(normalized);
  }

  const { data, error } = await query;
  if (error) throw new Error("Unable to load FSRS due candidates");
  return (data ?? []).map(toDueCandidate);
}

export async function loadDueCandidateResult(
  supabase: Supabase,
  userId: string,
  scope: FsrsDueScope,
  evaluationTime: string,
  limit?: number,
): Promise<{ total: number; candidates: FsrsDueCandidate[] }> {
  const [total, candidates] = await Promise.all([
    countDueCards(supabase, userId, scope, evaluationTime),
    findDueCandidates(supabase, userId, scope, evaluationTime, limit),
  ]);
  return { total, candidates };
}
