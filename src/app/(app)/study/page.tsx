import type { Metadata } from "next";

import {
  StudySourceSelect,
  type StudySourceOption,
} from "@/features/study/components/study-source-select";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Học" };

export default async function StudyPage() {
  const supabase = await createClient();
  const [setsResult, collectionsResult, totalResult] = await Promise.all([
    supabase
      .from("flashcard_sets")
      .select("id, name, flashcards(count)")
      .order("created_at", { ascending: false }),
    supabase
      .from("special_collections")
      .select("id, name, special_collection_items(count)")
      .order("created_at", { ascending: false }),
    supabase.from("flashcards").select("id", { count: "exact", head: true }),
  ]);

  const sets: StudySourceOption[] = (setsResult.data ?? []).map((set) => ({
    id: set.id,
    name: set.name,
    cardCount: set.flashcards[0]?.count ?? 0,
  }));
  const collections: StudySourceOption[] = (collectionsResult.data ?? []).map((collection) => ({
    id: collection.id,
    name: collection.name,
    cardCount: collection.special_collection_items[0]?.count ?? 0,
  }));
  const totalCards = totalResult.count ?? 0;

  return (
    <main className="mx-auto w-full max-w-4xl p-4 sm:p-8">
      <h1 className="text-3xl font-bold">Học</h1>
      <p className="mt-2 text-text-secondary">
        Chọn phạm vi học, lật thẻ và ôn luyện. Thẻ trùng giữa các nguồn chỉ tính một lần.
      </p>
      <StudySourceSelect sets={sets} collections={collections} totalCards={totalCards} />
    </main>
  );
}
