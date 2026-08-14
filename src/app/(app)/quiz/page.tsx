import type { Metadata } from "next";
import { Suspense } from "react";

import { QuizSetup } from "@/features/quiz/components/quiz-setup";
import { loadSourcePage, sourceType } from "@/features/source-selection/server/load-source-page";
import { parsePage, type RouteSearchParams } from "@/lib/pagination";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Kiểm tra" };

export default async function QuizPage({
  searchParams,
}: Readonly<{ searchParams: Promise<RouteSearchParams> }>) {
  const raw = await searchParams;

  return (
    <main className="mx-auto w-full max-w-4xl p-3 sm:p-8">
      <h1 className="text-2xl font-bold sm:text-3xl">Kiểm tra</h1>
      <Suspense fallback={<QuizLoading />}>
        <QuizCreator searchParams={raw} />
      </Suspense>
    </main>
  );
}

async function QuizCreator({ searchParams }: Readonly<{ searchParams: RouteSearchParams }>) {
  const supabase = await createClient();
  const query = typeof searchParams.q === "string" ? searchParams.q : "";
  const [sourcePage, totalResult] = await Promise.all([
    loadSourcePage(supabase, {
      page: parsePage(searchParams.page),
      query,
      type: sourceType(searchParams.sourceType),
    }),
    supabase.from("flashcards").select("id", { count: "exact", head: true }),
  ]);

  return (
    <section className="mt-3 sm:mt-5">
      <QuizSetup sourcePage={sourcePage} totalCards={totalResult.count ?? 0} />
    </section>
  );
}

function QuizLoading() {
  return (
    <section aria-label="Đang tải nội dung kiểm tra" className="mt-6 space-y-4" role="status">
      <div className="h-5 w-4/5 animate-pulse rounded-lg bg-surface-subtle" />
      <div className="h-16 animate-pulse rounded-2xl bg-surface-subtle" />
      <div className="h-16 animate-pulse rounded-2xl bg-surface-subtle" />
    </section>
  );
}
