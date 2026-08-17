import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/types";

const ID_BATCH_SIZE = 200;

/**
 * Counts cards that have never appeared in ANY mode: no quiz answer, no
 * match/typing event, and no spaced-repetition review event.
 */
export async function loadUntouchedCardCount(
  supabase: SupabaseClient<Database>,
  eligibleIds: string[],
): Promise<number> {
  if (eligibleIds.length === 0) return 0;
  const chunks = Array.from({ length: Math.ceil(eligibleIds.length / ID_BATCH_SIZE) }, (_, index) =>
    eligibleIds.slice(index * ID_BATCH_SIZE, (index + 1) * ID_BATCH_SIZE),
  );
  const [modeResults, quizResults, reviewResults] = await Promise.all([
    Promise.all(
      chunks.map((ids) =>
        supabase.from("mode_answer_events").select("flashcard_id").in("flashcard_id", ids),
      ),
    ),
    Promise.all(
      chunks.map((ids) =>
        supabase
          .from("quiz_questions")
          .select("flashcard_id")
          .in("flashcard_id", ids)
          .not("answered_at", "is", null),
      ),
    ),
    Promise.all(
      chunks.map((ids) =>
        supabase.from("card_review_events").select("flashcard_id").in("flashcard_id", ids),
      ),
    ),
  ]);
  const allResults = [...modeResults, ...quizResults, ...reviewResults];
  if (allResults.some((result) => result.error)) {
    throw new Error("untouched-card query failed");
  }

  const seen = new Set<string>();
  for (const result of allResults) {
    for (const row of result.data ?? []) {
      if (row.flashcard_id) seen.add(row.flashcard_id);
    }
  }

  return eligibleIds.filter((id) => !seen.has(id)).length;
}
