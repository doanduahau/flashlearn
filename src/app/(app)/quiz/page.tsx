import type { Metadata } from "next";
import Link from "next/link";

import { SectionTabs } from "@/components/shared/section-tabs";
import { QuizSetup } from "@/features/quiz/components/quiz-setup";
import { loadSourcePage, sourceType } from "@/features/source-selection/server/load-source-page";
import { parsePage, type RouteSearchParams } from "@/lib/pagination";
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
  const supabase = await createClient();

  return (
    <main className="mx-auto w-full max-w-4xl p-4 sm:p-8">
      <h1 className="text-3xl font-bold">Kiểm tra</h1>
      <p className="mt-2 text-text-secondary">
        Tạo bài kiểm tra mới hoặc xem lại các bài đã hoàn thành.
      </p>
      <SectionTabs
        label="Nội dung kiểm tra"
        current={tab}
        items={[
          { value: "create", label: "Tạo bài", href: "/quiz?tab=create" },
          { value: "history", label: "Lịch sử", href: "/quiz?tab=history" },
        ]}
      />
      {tab === "history" ? (
        <QuizHistory supabase={supabase} />
      ) : (
        <QuizCreator supabase={supabase} searchParams={raw} />
      )}
    </main>
  );
}

async function QuizCreator({
  supabase,
  searchParams,
}: Readonly<{
  supabase: Awaited<ReturnType<typeof createClient>>;
  searchParams: RouteSearchParams;
}>) {
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
    <section className="mt-6">
      <p className="text-text-secondary">
        Chọn nguồn, số câu và cách tạo đề. Thẻ trùng chỉ xuất hiện một lần.
      </p>
      <QuizSetup sourcePage={sourcePage} totalCards={totalResult.count ?? 0} />
    </section>
  );
}

async function QuizHistory({
  supabase,
}: Readonly<{ supabase: Awaited<ReturnType<typeof createClient>> }>) {
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
