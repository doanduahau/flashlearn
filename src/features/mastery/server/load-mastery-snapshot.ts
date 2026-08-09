import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { findActiveCardIds, findReviewEvents } from "@/features/mastery/server/load-card-masteries";
import type { SmartReviewCandidateResult } from "@/features/mastery/types/mastery-types";
import {
  loadMasterySnapshotWithRepository,
  type MasterySnapshot,
} from "@/features/mastery/utils/load-mastery-snapshot";
import type { Database } from "@/lib/supabase/types";

type Supabase = SupabaseClient<Database>;

const SCOPE_ID_PAGE_SIZE = 1000;

export type MasterySnapshotScope =
  | { type: "library" }
  | { type: "set"; setId: string }
  | { type: "collection"; collectionId: string };

export type LoadMasterySnapshotOptions = {
  evaluationTime?: string;
  reviewCandidateLimit?: number;
};

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
    if (error) throw new Error("Unable to load active flashcards for mastery snapshot");

    const page = data ?? [];
    ids.push(...page.map((item) => item.flashcard_id));
    if (page.length === 0) return ids;
    start += page.length;
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
    if (error) throw new Error("Unable to load active flashcards for mastery snapshot");

    const page = data ?? [];
    ids.push(...page.map((card) => card.id));
    if (page.length < SCOPE_ID_PAGE_SIZE) return ids;
    start += SCOPE_ID_PAGE_SIZE;
  }
}

async function findActiveCardIdsInScope(
  supabase: Supabase,
  scope: MasterySnapshotScope,
): Promise<string[]> {
  if (scope.type === "collection") return findCollectionCardIds(supabase, scope.collectionId);
  return findFlashcardIdsInScope(supabase, scope);
}

/**
 * Loads one fixed-time, user-RLS-scoped mastery snapshot. Aggregate and Smart
 * Review projections must be read from this object together when both are needed.
 */
export async function loadMasterySnapshot(
  supabase: Supabase,
  scope: MasterySnapshotScope,
  options: LoadMasterySnapshotOptions = {},
): Promise<MasterySnapshot> {
  const evaluationTime = options.evaluationTime ?? new Date().toISOString();

  return loadMasterySnapshotWithRepository(
    {
      findActiveCardIdsInScope: () => findActiveCardIdsInScope(supabase, scope),
      findActiveCardIds: (cardIds) => findActiveCardIds(supabase, cardIds),
      findReviewEvents: (cardIds) => findReviewEvents(supabase, cardIds),
    },
    evaluationTime,
    options.reviewCandidateLimit,
  );
}

export async function loadSmartReviewCandidates(
  supabase: Supabase,
  scope: MasterySnapshotScope,
  options: LoadMasterySnapshotOptions = {},
): Promise<SmartReviewCandidateResult> {
  const snapshot = await loadMasterySnapshot(supabase, scope, options);
  return snapshot.reviewCandidates;
}
