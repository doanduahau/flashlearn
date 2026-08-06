import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
export const metadata: Metadata = { title: "Lịch sử" };
export default async function HistoryPage() {
  const supabase = await createClient();
  const { data: sessions, error } = await supabase
    .from("quiz_sessions")
    .select("id, mode, actual_question_count, correct_answer_count, completed_at")
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false })
    .limit(50);
  return (
    <main className="mx-auto w-full max-w-4xl p-4 sm:p-8">
      <h1 className="text-3xl font-bold">Lịch sử</h1>
      {error ? (
        <p role="alert" className="mt-4 text-danger">
          Không thể tải lịch sử.
        </p>
      ) : sessions?.length ? (
        <ul className="mt-6 space-y-3">
          {sessions.map((session) => (
            <li key={session.id} className="rounded-2xl border border-border-soft p-4">
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
    </main>
  );
}
