import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { SectionTabs } from "@/components/shared/section-tabs";
import { QuizSetup } from "@/features/quiz/components/quiz-setup";
import { loadSourcePage, sourceType } from "@/features/source-selection/server/load-source-page";
import { parsePage, type RouteSearchParams, updateSearchParamHref } from "@/lib/pagination";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Kiểm tra" };

type QuizTab = "create" | "history";

function quizTab(value: string | string[] | undefined): QuizTab {
  return value === "history" ? "history" : "create";
}

export default async function QuizPage({
  searchParams,
}: Readonly<{ searchParams: Promise<RouteSearchParams> }>) {
  const raw = await searchParams;
  const tab = quizTab(raw.tab);

  return (
    <main className="mx-auto w-full max-w-4xl p-3 sm:p-8">
      <h1 className="text-2xl font-bold sm:text-3xl">Kiểm tra</h1>
      <SectionTabs
        label="Nội dung kiểm tra"
        current={tab}
        items={[
          {
            value: "create",
            label: "Tạo bài",
            href: updateSearchParamHref("/quiz", raw, "tab", "create"),
          },
          {
            value: "history",
            label: "Lịch sử",
            href: updateSearchParamHref("/quiz", raw, "tab", "history"),
          },
        ]}
        pendingContent={<QuizTabLoading />}
      >
        <Suspense fallback={<QuizTabLoading />}>
          {tab === "history" ? <QuizHistory /> : <QuizCreator searchParams={raw} />}
        </Suspense>
      </SectionTabs>
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

async function QuizHistory() {
  const supabase = await createClient();
  const { data: sessions, error } = await supabase
    .from("quiz_sessions")
    .select("id, mode, actual_question_count, correct_answer_count, completed_at")
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false })
    .limit(50);

  return (
    <section className="mt-6" aria-labelledby="quiz-history-heading">
      <h2 id="quiz-history-heading" className="text-xl font-bold">
        Lịch sử bài kiểm tra
      </h2>
      {error ? (
        <p role="alert" className="mt-4 text-danger">
          Không thể tải lịch sử.
        </p>
      ) : sessions?.length ? (
        <ul className="mt-4 space-y-3">
          {sessions.map((session) => (
            <li key={session.id} className="rounded-2xl border border-border-soft bg-surface p-4">
              <Link className="font-semibold underline" href={`/quiz/${session.id}/result`}>
                {session.correct_answer_count}/{session.actual_question_count} đúng · {session.mode}
              </Link>
              <p className="text-sm text-text-secondary">
                {session.completed_at ? new Date(session.completed_at).toLocaleString("vi-VN") : ""}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-text-secondary">Bạn chưa hoàn thành bài kiểm tra nào.</p>
      )}
    </section>
  );
}

function QuizTabLoading() {
  return (
    <section aria-label="Đang tải nội dung kiểm tra" className="mt-6 space-y-4" role="status">
      <div className="h-5 w-4/5 animate-pulse rounded-lg bg-surface-subtle" />
      <div className="h-16 animate-pulse rounded-2xl bg-surface-subtle" />
      <div className="h-16 animate-pulse rounded-2xl bg-surface-subtle" />
    </section>
  );
}
