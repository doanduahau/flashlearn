import type { Metadata } from "next";

import { MemorySetup } from "@/features/memory/components/memory-setup";
import { loadMascotLevel } from "@/features/mascot/server/load-mascot-level";
import { loadSourcePage, sourceType } from "@/features/source-selection/server/load-source-page";
import { parsePage, type RouteSearchParams } from "@/lib/pagination";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Memory" };

export default async function MemoryPage({
  searchParams,
}: Readonly<{ searchParams: Promise<RouteSearchParams> }>) {
  const raw = await searchParams;
  const supabase = await createClient();
  const query = typeof raw.q === "string" ? raw.q : "";
  const [sourcePage, totalResult, mascotLevel] = await Promise.all([
    loadSourcePage(supabase, {
      page: parsePage(raw.page),
      query,
      type: sourceType(raw.sourceType),
    }),
    supabase.from("flashcards").select("id", { count: "exact", head: true }),
    loadMascotLevel(supabase),
  ]);

  return (
    <main className="mx-auto w-full max-w-4xl p-3 sm:p-8">
      <h1 className="text-2xl font-bold sm:text-3xl">Memory Matching</h1>
      <MemorySetup
        sourcePage={sourcePage}
        totalCards={totalResult.count ?? 0}
        mascotLevel={mascotLevel}
      />
    </main>
  );
}
