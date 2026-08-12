import type { Metadata } from "next";
import Link from "next/link";

import { StudySourceSelect } from "@/features/study/components/study-source-select";
import { loadSourcePage, sourceType } from "@/features/source-selection/server/load-source-page";
import { parsePage, type RouteSearchParams } from "@/lib/pagination";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Học" };

export default async function StudyPage({
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
      <h1 className="text-2xl font-bold sm:text-3xl">Học</h1>
      <section aria-label="Chế độ học" className="mt-3 space-y-2 sm:mt-5 sm:space-y-3">
        <Link
          className="flex items-center gap-2 rounded-xl border border-border-soft bg-surface px-3 py-2 text-sm font-medium hover:bg-surface-subtle sm:rounded-2xl sm:px-4 sm:py-3"
          href="/match"
        >
          Match
          <span className="text-xs font-normal text-text-secondary">nối mặt trước với mặt sau</span>
        </Link>
      </section>
      <StudySourceSelect sourcePage={sourcePage} totalCards={totalResult.count ?? 0} />

      <section aria-label="Trò chơi" className="mt-6 sm:mt-8">
        <h2 className="text-base font-bold sm:text-lg">Chơi</h2>
        <div className="mt-2 space-y-2 sm:mt-3 sm:space-y-3">
          <Link
            className="flex items-center gap-2 rounded-xl border border-border-soft bg-surface px-3 py-2 text-sm font-medium hover:bg-surface-subtle sm:rounded-2xl sm:px-4 sm:py-3"
            href="/memory"
          >
            Memory Matching
            <span className="text-xs font-normal text-text-secondary">
              lật và ghép cặp mặt trước với mặt sau
            </span>
          </Link>
        </div>
      </section>
    </main>
  );
}
