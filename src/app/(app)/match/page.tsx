import type { Metadata } from "next";

import { MatchSetup } from "@/features/match/components/match-setup";
import { loadSourcePage, sourceType } from "@/features/source-selection/server/load-source-page";
import { parsePage, type RouteSearchParams } from "@/lib/pagination";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Match" };

export default async function MatchPage({
  searchParams,
}: Readonly<{ searchParams: Promise<RouteSearchParams> }>) {
  const raw = await searchParams;
  const supabase = await createClient();
  const query = typeof raw.q === "string" ? raw.q : "";
  const sourcePage = await loadSourcePage(supabase, {
    page: parsePage(raw.page),
    query,
    type: sourceType(raw.sourceType),
  });

  return (
    <main className="mx-auto w-full max-w-4xl p-3 sm:p-8">
      <h1 className="text-2xl font-bold sm:text-3xl">Match</h1>
      <MatchSetup sourcePage={sourcePage} />
    </main>
  );
}
