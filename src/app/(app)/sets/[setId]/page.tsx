import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export default async function SetDetailPage({
  params,
}: Readonly<{ params: Promise<{ setId: string }> }>) {
  const { setId } = await params;
  const supabase = await createClient();
  const { data: set } = await supabase
    .from("flashcard_sets")
    .select("id, name")
    .eq("id", setId)
    .maybeSingle();
  if (!set) notFound();
  const { data: cards } = await supabase
    .from("flashcards")
    .select("id, front, back, position")
    .eq("set_id", set.id)
    .order("position");
  return (
    <main className="mx-auto w-full max-w-4xl p-4 sm:p-8">
      <h1 className="text-3xl font-bold">{set.name}</h1>
      <p className="mt-2 text-text-secondary">{cards?.length ?? 0} flashcard</p>
      <ol className="mt-6 grid gap-3">
        {cards?.map((card) => (
          <li key={card.id} className="rounded-2xl border border-border-soft bg-surface p-5">
            <p className="font-semibold">{card.front}</p>
            <p className="mt-2 text-text-secondary">{card.back}</p>
          </li>
        ))}
      </ol>
    </main>
  );
}
