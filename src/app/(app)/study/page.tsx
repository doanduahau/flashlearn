import type { Metadata } from "next";
import Link from "next/link";

import { ModeTabs } from "@/components/shared/mode-tabs";
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
  const tab = raw.tab === "play" ? "play" : "traditional";
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
      <ModeTabs
        label="Khu vực học"
        items={[
          { label: "Học truyền thống", href: "/study", active: tab === "traditional" },
          { label: "Vừa học vừa chơi", href: "/study?tab=play", active: tab === "play" },
        ]}
      />
      {tab === "play" ? (
        <PlayModes />
      ) : (
        <StudySourceSelect sourcePage={sourcePage} totalCards={totalResult.count ?? 0} />
      )}
    </main>
  );
}

function PlayModes() {
  return (
    <section aria-label="Vừa học vừa chơi" className="mt-3 space-y-2 sm:mt-5 sm:space-y-3">
      <Link
        className="flex items-center gap-2 rounded-xl border border-border-soft bg-surface px-3 py-2 text-sm font-medium hover:bg-surface-subtle sm:rounded-2xl sm:px-4 sm:py-3"
        href="/memory"
      >
        Memory Matching
        <span className="text-xs font-normal text-text-secondary">
          lật và ghép cặp mặt trước với mặt sau
        </span>
      </Link>
      <Link
        className="flex items-center gap-2 rounded-xl border border-border-soft bg-surface px-3 py-2 text-sm font-medium hover:bg-surface-subtle sm:rounded-2xl sm:px-4 sm:py-3"
        href="/runner"
      >
        Flashcard Runner
        <span className="text-xs font-normal text-text-secondary">
          vừa chạy vừa bắt đáp án đúng
        </span>
      </Link>
    </section>
  );
}
