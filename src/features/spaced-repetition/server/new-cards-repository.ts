import "server-only";

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

const NEW_CARDS_BATCH_SIZE = 10;

function normalizeLimit(limit: number | undefined): number {
  if (limit === undefined) return NEW_CARDS_BATCH_SIZE;
  return Math.max(0, Math.min(NEW_CARDS_BATCH_SIZE, Math.floor(limit)));
}

/**
 * Genuine New Cards are active cards owned by auth.uid() with neither a
 * schedule projection nor a schedulable historical review fact. The SQL RPC
 * returns the full total and its ordered top-N candidates in one RLS-scoped
 * read.
 */
export async function loadNewCardCandidateResult(
  supabase: Supabase,
  limit?: number,
): Promise<NewCardCandidateResult> {
  const { data, error } = await supabase.rpc("load_new_card_candidates", {
    p_limit: normalizeLimit(limit),
  });

  if (error) throw new Error("Unable to load New Card candidates");

  const rows = data ?? [];
  const total = Number(rows[0]?.total ?? 0);
  const candidates = rows.flatMap((row) =>
    row.flashcard_id && row.created_at
      ? [{ flashcardId: row.flashcard_id, createdAt: row.created_at }]
      : [],
  );

  return { total, candidates };
}

export async function countNewCards(supabase: Supabase): Promise<number> {
  const result = await loadNewCardCandidateResult(supabase, 0);
  return result.total;
}
