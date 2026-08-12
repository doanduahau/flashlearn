"use server";

import { createClient } from "@/lib/supabase/server";

export type CoverageMode = "quiz" | "match" | "memory" | "runner";

export async function loadUncoveredIds(
  mode: CoverageMode,
  eligibleIds: string[],
): Promise<string[]> {
  if (eligibleIds.length === 0) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("flashcard_coverage")
    .select("flashcard_id")
    .eq("mode", mode)
    .in("flashcard_id", eligibleIds);

  const covered = new Set((data ?? []).map((row) => row.flashcard_id));
  return eligibleIds.filter((id) => !covered.has(id));
}

export async function commitCardCoverage(mode: CoverageMode, cardIds: string[]): Promise<void> {
  if (cardIds.length === 0) return;
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;
  if (!userId) return;
  const rows = cardIds.map((id) => ({ user_id: userId, mode, flashcard_id: id }));
  await supabase.from("flashcard_coverage").upsert(rows, {
    onConflict: "user_id,mode,flashcard_id",
  });
}

export async function commitCoverageAndResetScope(
  mode: CoverageMode,
  sessionCardIds: string[],
  scopeEligibleIds: string[],
): Promise<void> {
  await commitCardCoverage(mode, sessionCardIds);
  if (scopeEligibleIds.length === 0) return;

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;
  if (!userId) return;

  // Check if all eligible cards in scope are now covered.
  const { data } = await supabase
    .from("flashcard_coverage")
    .select("flashcard_id")
    .eq("user_id", userId)
    .eq("mode", mode)
    .in("flashcard_id", scopeEligibleIds);

  const coveredInScope = new Set((data ?? []).map((row) => row.flashcard_id));
  const allCovered = scopeEligibleIds.every((id) => coveredInScope.has(id));

  if (allCovered) {
    await supabase
      .from("flashcard_coverage")
      .delete()
      .eq("user_id", userId)
      .eq("mode", mode)
      .in("flashcard_id", scopeEligibleIds);
  }
}
