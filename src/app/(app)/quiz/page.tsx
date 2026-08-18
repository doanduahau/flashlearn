import type { Metadata } from "next";
import { Suspense } from "react";

import { BrandLoading } from "@/components/shared/brand-loading";
import { QuizSetup } from "@/features/quiz/components/quiz-setup";
import { loadMascotLevel } from "@/features/mascot/server/load-mascot-level";
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
  const [sourcePage, totalResult, mascotLevel] = await Promise.all([
    loadSourcePage(supabase, {
      page: parsePage(searchParams.page),
      query,
      type: sourceType(searchParams.sourceType),
    }),
    supabase.from("flashcards").select("id", { count: "exact", head: true }),
    loadMascotLevel(supabase),
  ]);

  return (
    <section className="mt-3 sm:mt-5">
      <QuizSetup
        sourcePage={sourcePage}
        totalCards={totalResult.count ?? 0}
        mascotLevel={mascotLevel}
      />
    </section>
  );
}

function QuizLoading() {
  return <BrandLoading title="Đang tải nội dung kiểm tra" />;
}
