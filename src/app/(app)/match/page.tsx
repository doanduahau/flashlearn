import type { Metadata } from "next";

import { ModeTabs } from "@/components/shared/mode-tabs";
import { MatchSetup } from "@/features/match/components/match-setup";
import { loadSourcePage, sourceType } from "@/features/source-selection/server/load-source-page";
import { parsePage, type RouteSearchParams } from "@/lib/pagination";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Kiểm tra" };

export default async function MatchPage({
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
      <h1 className="text-2xl font-bold sm:text-3xl">Kiểm tra</h1>
      <ModeTabs
        label="Khu vực kiểm tra"
        items={[
          { label: "Trắc nghiệm", href: "/quiz", active: false },
          { label: "Match", href: "/match", active: true },
        ]}
      />
      <MatchSetup sourcePage={sourcePage} totalCards={totalResult.count ?? 0} />
    </main>
  );
}
