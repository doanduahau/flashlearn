import type { Metadata } from "next";

import { RunnerSetup } from "@/features/runner/components/runner-setup";
import { loadSourcePage, sourceType } from "@/features/source-selection/server/load-source-page";
import { parsePage, type RouteSearchParams } from "@/lib/pagination";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Capy Runner" };

export default async function RunnerPage({
  searchParams,
}: Readonly<{ searchParams: Promise<RouteSearchParams> }>) {
  const raw = await searchParams;
  const supabase = await createClient();
  const query = typeof raw.q === "string" ? raw.q : "";
  const [sourcePage, totalResult] = await Promise.all([
    loadSourcePage(supabase, {
      page: parsePage(raw.page),
      query,
      type: sourceType(raw.sourceType),
    }),
    supabase.from("flashcards").select("id", { count: "exact", head: true }),
  ]);

  return (
    <main className="mx-auto w-full max-w-4xl p-3 sm:p-8">
      <h1 className="text-2xl font-bold sm:text-3xl">Capy Runner</h1>
      <RunnerSetup sourcePage={sourcePage} totalCards={totalResult.count ?? 0} />
    </main>
  );
}
