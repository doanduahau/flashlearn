import type { Metadata } from "next";

import { SetsList, type SetSummary } from "@/features/flashcard-sets/components/sets-list";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Bộ flashcard" };

export default async function SetsPage() {
  const supabase = await createClient();
  const [setsResult, cardsResult] = await Promise.all([
    supabase.from("flashcard_sets").select("id, name").order("created_at", { ascending: false }),
    supabase.from("flashcards").select("set_id"),
  ]);

  const cardCounts = new Map<string, number>();
  for (const card of cardsResult.data ?? []) {
    cardCounts.set(card.set_id, (cardCounts.get(card.set_id) ?? 0) + 1);
  }

  const sets: SetSummary[] = (setsResult.data ?? []).map((set) => ({
    id: set.id,
    name: set.name,
    cardCount: cardCounts.get(set.id) ?? 0,
  }));

  return (
    <main className="mx-auto w-full max-w-4xl p-4 sm:p-8">
      <h1 className="text-3xl font-bold">Bộ flashcard</h1>
      <SetsList sets={sets} />
    </main>
  );
}
