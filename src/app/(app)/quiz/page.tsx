import type { Metadata } from "next";
import { QuizSetup, type QuizSource } from "@/features/quiz/components/quiz-setup";
import { createClient } from "@/lib/supabase/server";
export const metadata: Metadata = { title: "Kiểm tra" };
export default async function QuizPage() {
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
  const sets: QuizSource[] = (setsResult.data ?? []).map((set) => ({
    id: set.id,
    name: set.name,
    cardCount: set.flashcards[0]?.count ?? 0,
  }));
  const collections: QuizSource[] = (collectionsResult.data ?? []).map((collection) => ({
    id: collection.id,
    name: collection.name,
    cardCount: collection.special_collection_items[0]?.count ?? 0,
  }));
  return (
    <main className="mx-auto w-full max-w-4xl p-4 sm:p-8">
      <h1 className="text-3xl font-bold">Kiểm tra</h1>
      <p className="mt-2 text-text-secondary">
        Chọn nguồn, số câu và cách tạo đề. Thẻ trùng chỉ xuất hiện một lần.
      </p>
      <QuizSetup sets={sets} collections={collections} totalCards={totalResult.count ?? 0} />
    </main>
  );
}
