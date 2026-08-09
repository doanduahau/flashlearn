import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { findActiveCardIds, findReviewEvents } from "@/features/mastery/server/load-card-masteries";
import type { MasteryAggregate } from "@/features/mastery/utils/aggregate-mastery";
import { loadMasteryAggregateWithRepository } from "@/features/mastery/utils/load-mastery-aggregate";
import type { Database } from "@/lib/supabase/types";

type Supabase = SupabaseClient<Database>;

const SCOPE_ID_PAGE_SIZE = 1000;

export type MasteryAggregateScope =
  | { type: "library" }
  | { type: "set"; setId: string }
  | { type: "collection"; collectionId: string };

async function findCollectionCardIds(supabase: Supabase, collectionId: string): Promise<string[]> {
  const ids: string[] = [];
  let start = 0;

  while (true) {
    const { data, error } = await supabase
      .from("special_collection_items")
      .select("flashcard_id")
      .eq("collection_id", collectionId)
      .order("flashcard_id", { ascending: true })
      .range(start, start + SCOPE_ID_PAGE_SIZE - 1);
    if (error) throw new Error("Unable to load active flashcards for mastery aggregate");

    const page = data ?? [];
    ids.push(...page.map((item) => item.flashcard_id));
    if (page.length < SCOPE_ID_PAGE_SIZE) return ids;
    start += SCOPE_ID_PAGE_SIZE;
  }
}

async function findFlashcardIdsInScope(
  supabase: Supabase,
  scope: { type: "library" } | { type: "set"; setId: string },
): Promise<string[]> {
  const ids: string[] = [];
  let start = 0;

  while (true) {
    let query = supabase.from("flashcards").select("id").order("id", { ascending: true });
    if (scope.type === "set") query = query.eq("set_id", scope.setId);

    const { data, error } = await query.range(start, start + SCOPE_ID_PAGE_SIZE - 1);
    if (error) throw new Error("Unable to load active flashcards for mastery aggregate");

    const page = data ?? [];
    ids.push(...page.map((card) => card.id));
    if (page.length < SCOPE_ID_PAGE_SIZE) return ids;
    start += SCOPE_ID_PAGE_SIZE;
  }
}

async function findActiveCardIdsInScope(
  supabase: Supabase,
  scope: MasteryAggregateScope,
): Promise<string[]> {
  if (scope.type === "collection") return findCollectionCardIds(supabase, scope.collectionId);
  return findFlashcardIdsInScope(supabase, scope);
}

export async function loadMasteryAggregate(
  supabase: Supabase,
  scope: MasteryAggregateScope,
  evaluationTime = new Date().toISOString(),
): Promise<MasteryAggregate> {
  return loadMasteryAggregateWithRepository(
    {
      findActiveCardIdsInScope: () => findActiveCardIdsInScope(supabase, scope),
      findActiveCardIds: (cardIds) => findActiveCardIds(supabase, cardIds),
      findReviewEvents: (cardIds) => findReviewEvents(supabase, cardIds),
    },
    evaluationTime,
  );
}
