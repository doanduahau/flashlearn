import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/types";

type Supabase = SupabaseClient<Database>;

export const ACTIVE_CARD_IN_BATCH_SIZE = 200;
export const ACTIVE_CARD_PAGE_SIZE = 1000;

export type ActiveCardLoaderError = {
  code: string | null;
  status: number | null;
  category: "postgrest" | "network" | "unknown";
};

export type ActiveCardLoaderBatchTrace = {
  inputIdCount: number;
  pagesRequested: number;
  rowsReturned: number;
  error: ActiveCardLoaderError | null;
};

export type ActiveCardLoaderTrace = {
  batches: ActiveCardLoaderBatchTrace[];
  returnedCardIds: string[];
};

export type FindActiveCardIdsOptions = {
  inBatchSize?: number;
  trace?: ActiveCardLoaderTrace;
};

export function createActiveCardLoaderTrace(): ActiveCardLoaderTrace {
  return { batches: [], returnedCardIds: [] };
}

function normalizeBatchSize(inBatchSize: number | undefined): number {
  if (inBatchSize === undefined) return ACTIVE_CARD_IN_BATCH_SIZE;
  if (!Number.isInteger(inBatchSize) || inBatchSize < 1) {
    throw new Error("Active-card loader batch size must be a positive integer");
  }
  return inBatchSize;
}

function sanitizeError(error: unknown): ActiveCardLoaderError {
  if (typeof error !== "object" || error === null) {
    return { code: null, status: null, category: "unknown" };
  }

  const candidate = error as { code?: unknown; status?: unknown };
  const code = typeof candidate.code === "string" ? candidate.code : null;
  const status = typeof candidate.status === "number" ? candidate.status : null;
  const category = code?.startsWith("PGRST")
    ? "postgrest"
    : status === null
      ? "unknown"
      : "network";
  return { code, status, category };
}

/**
 * Returns only active, RLS-visible flashcard IDs. Errors deliberately reject
 * instead of being interpreted as an empty active-card set.
 */
export async function findActiveCardIdsWithOptions(
  supabase: Supabase,
  cardIds: readonly string[],
  options: FindActiveCardIdsOptions = {},
): Promise<string[]> {
  const results: string[] = [];
  const uniqueIds = [...new Set(cardIds)];
  const inBatchSize = normalizeBatchSize(options.inBatchSize);

  for (let batch = 0; batch < uniqueIds.length; batch += inBatchSize) {
    const batchIds = uniqueIds.slice(batch, batch + inBatchSize);
    const batchTrace: ActiveCardLoaderBatchTrace = {
      inputIdCount: batchIds.length,
      pagesRequested: 0,
      rowsReturned: 0,
      error: null,
    };
    options.trace?.batches.push(batchTrace);
    let start = 0;

    while (true) {
      batchTrace.pagesRequested += 1;
      const { data, error } = await supabase
        .from("flashcards")
        .select("id")
        .in("id", batchIds)
        .order("id", { ascending: true })
        .range(start, start + ACTIVE_CARD_PAGE_SIZE - 1);

      if (error) {
        batchTrace.error = sanitizeError(error);
        throw new Error("Unable to load active flashcards for mastery");
      }

      const page = data ?? [];
      const pageIds = page.map((card) => card.id);
      results.push(...pageIds);
      options.trace?.returnedCardIds.push(...pageIds);
      batchTrace.rowsReturned += page.length;
      if (page.length === 0) break;
      start += page.length;
    }
  }

  return results;
}
