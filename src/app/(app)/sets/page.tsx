import type { Metadata } from "next";

import { SetsList, type SetSummary } from "@/features/flashcard-sets/components/sets-list";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Bộ flashcard" };

export default async function SetsPage() {
  const supabase = await createClient();
  const { data: setRows } = await supabase
    .from("flashcard_sets")
    .select("id, name, flashcards(count)")
    .order("created_at", { ascending: false });

  const sets: SetSummary[] = (setRows ?? []).map((set) => ({
    id: set.id,
    name: set.name,
    cardCount: set.flashcards[0]?.count ?? 0,
  }));

  return (
    <main className="mx-auto w-full max-w-4xl p-4 sm:p-8">
      <h1 className="text-3xl font-bold">Bộ flashcard</h1>
      <SetsList sets={sets} />
    </main>
  );
}
