import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  StudyCard,
  StudyCollectionOption,
  StudySourceParams,
  StudySourceRow,
} from "@/features/study/types/study-types";
import {
  capRows,
  collectUniqueIds,
  collectUniqueRows,
  compareRows,
} from "@/features/study/utils/merge-cards";
import { STUDY_MAX_CARDS } from "@/lib/constants";
import type { Database } from "@/lib/supabase/types";

type Supabase = SupabaseClient<Database>;

export interface StudyCardsResult {
  cards: StudyCard[];
  truncated: boolean;
}

async function fetchSetRows(supabase: Supabase, setIds: string[]): Promise<StudySourceRow[]> {
  const { data } = await supabase
    .from("flashcards")
    .select("id, front, back, set_id, position, flashcard_sets(name)")
    .in("set_id", setIds);
  return data ?? [];
}

async function fetchCollectionRows(
  supabase: Supabase,
  collectionIds: string[],
): Promise<StudySourceRow[]> {
  const { data } = await supabase
    .from("special_collection_items")
    .select("flashcard_id, flashcards(id, front, back, set_id, position, flashcard_sets(name))")
    .in("collection_id", collectionIds);
  return (data ?? [])
    .map((item) => item.flashcards)
    .filter((card): card is StudySourceRow => card !== null);
}

async function fetchAllRows(supabase: Supabase): Promise<StudySourceRow[]> {
  const { data } = await supabase
    .from("flashcards")
    .select("id, front, back, set_id, position, flashcard_sets(name)");
  return data ?? [];
}

function toStudyCard(row: StudySourceRow): StudyCard {
  return {
    id: row.id,
    front: row.front,
    back: row.back,
    setId: row.set_id,
    setName: row.flashcard_sets.name,
  };
}

export async function fetchStudyCards(
  supabase: Supabase,
  params: StudySourceParams,
): Promise<StudyCardsResult> {
  const groups: StudySourceRow[][] = [];
  if (params.all) {
    groups.push(await fetchAllRows(supabase));
  } else {
    if (params.setIds.length) groups.push(await fetchSetRows(supabase, params.setIds));
    if (params.collectionIds.length)
      groups.push(await fetchCollectionRows(supabase, params.collectionIds));
  }

  const unique = collectUniqueRows(groups);
  const ordered = [...unique].sort(compareRows);
  const capped = capRows(ordered, STUDY_MAX_CARDS);
  return { cards: capped.rows.map(toStudyCard), truncated: capped.truncated };
}

export async function collectStudyCardIds(
  supabase: Supabase,
  params: StudySourceParams,
): Promise<string[]> {
  const groups: string[][] = [];
  if (params.all) {
    const { data } = await supabase.from("flashcards").select("id");
    groups.push((data ?? []).map((row) => row.id));
  } else {
    if (params.setIds.length) {
      const { data } = await supabase.from("flashcards").select("id").in("set_id", params.setIds);
      groups.push((data ?? []).map((row) => row.id));
    }
    if (params.collectionIds.length) {
      const { data } = await supabase
        .from("special_collection_items")
        .select("flashcard_id")
        .in("collection_id", params.collectionIds);
      groups.push((data ?? []).map((row) => row.flashcard_id));
    }
  }
  return collectUniqueIds(groups);
}

export async function fetchSessionMemberships(
  supabase: Supabase,
  cardIds: string[],
): Promise<{ collections: StudyCollectionOption[]; membershipsByCard: Record<string, string[]> }> {
  const [collectionsResult, membershipsResult] = await Promise.all([
    supabase.from("special_collections").select("id, name").order("name", { ascending: true }),
    cardIds.length
      ? supabase
          .from("special_collection_items")
          .select("collection_id, flashcard_id")
          .in("flashcard_id", cardIds)
      : Promise.resolve({ data: [] as { collection_id: string; flashcard_id: string }[] }),
  ]);

  const collections = (collectionsResult.data ?? []).map((collection) => ({
    id: collection.id,
    name: collection.name,
  }));

  const membershipsByCard: Record<string, string[]> = {};
  for (const item of membershipsResult.data ?? []) {
    (membershipsByCard[item.flashcard_id] ??= []).push(item.collection_id);
  }

  return { collections, membershipsByCard };
}
