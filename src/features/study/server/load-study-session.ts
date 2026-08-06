import type { SupabaseClient } from "@supabase/supabase-js";

import { parseStudySessionParams } from "@/features/study/schemas/study-schema";
import { fetchSessionMemberships, fetchStudyCards } from "@/features/study/server/load-study-cards";
import type {
  StudyCard,
  StudyCollectionOption,
  StudySessionParams,
} from "@/features/study/types/study-types";
import { seededShuffle } from "@/features/study/utils/shuffle";
import type { Database } from "@/lib/supabase/types";

type Supabase = SupabaseClient<Database>;

export interface StudySessionData {
  params: StudySessionParams;
  cards: StudyCard[];
  collections: StudyCollectionOption[];
  membershipsByCard: Record<string, string[]>;
  truncated: boolean;
  sessionHref: string;
}

export function buildSessionHref(params: StudySessionParams): string {
  const query = new URLSearchParams();
  if (params.all) query.set("all", "1");
  if (params.setIds.length) query.set("sets", params.setIds.join(","));
  if (params.collectionIds.length) query.set("collections", params.collectionIds.join(","));
  if (params.seed !== undefined) query.set("seed", String(params.seed));
  const search = query.toString();
  return `/study/session${search ? `?${search}` : ""}`;
}

export async function loadStudySession(
  supabase: Supabase,
  raw: Record<string, string | string[] | undefined>,
): Promise<StudySessionData | null> {
  const params = parseStudySessionParams(raw);
  if (!params) return null;

  const fetched = await fetchStudyCards(supabase, params);
  let cards = fetched.cards;
  if (params.seed !== undefined) {
    cards = seededShuffle(cards, params.seed);
  }
  if (cards.length === 0) return null;

  const { collections, membershipsByCard } = await fetchSessionMemberships(
    supabase,
    cards.map((card) => card.id),
  );

  return {
    params,
    cards,
    collections,
    membershipsByCard,
    truncated: fetched.truncated,
    sessionHref: buildSessionHref(params),
  };
}
