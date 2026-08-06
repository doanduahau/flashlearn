import type { Metadata } from "next";

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
    <main className="mx-auto w-full max-w-4xl p-4 sm:p-8">
      <h1 className="text-3xl font-bold">Học</h1>
      <p className="mt-2 text-text-secondary">
        Chọn phạm vi học, lật thẻ và ôn luyện. Thẻ trùng giữa các nguồn chỉ tính một lần.
      </p>
      <StudySourceSelect sourcePage={sourcePage} totalCards={totalResult.count ?? 0} />
    </main>
  );
}
