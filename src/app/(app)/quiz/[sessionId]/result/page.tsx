import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
export default async function QuizResultPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const supabase = await createClient();
  const { data: session } = await supabase
    .from("quiz_sessions")
    .select("mode, actual_question_count, correct_answer_count, completed_at")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) notFound();
  if (!session.completed_at) redirect(`/quiz/${sessionId}`);
  const { data: questions } = await supabase
    .from("quiz_questions")
    .select("id, position, prompt, correct_answer, choices, selected_choice_index, is_correct")
    .eq("session_id", sessionId)
    .order("position");
  const percentage = Math.round(
    (session.correct_answer_count / session.actual_question_count) * 100,
  );
  return (
    <main className="mx-auto w-full max-w-3xl p-4 sm:p-8">
      <h1 className="text-3xl font-bold">Kết quả kiểm tra</h1>
      <p className="mt-3 text-xl">
        {session.correct_answer_count}/{session.actual_question_count} đúng ({percentage}%)
      </p>
      <section className="mt-8 space-y-4" aria-label="Xem lại câu trả lời">
        {(questions ?? []).map((q) => (
          <article key={q.id} className="rounded-2xl border border-border-soft p-4">
            <p className="whitespace-pre-wrap font-semibold">
              {q.position + 1}. {q.prompt}
            </p>
            <p>
              Đáp án của bạn:{" "}
              <span className="whitespace-pre-wrap">
                {q.selected_choice_index === null
                  ? "Chưa trả lời"
                  : (q.choices as string[])[q.selected_choice_index]}
              </span>
            </p>
            <p>
              Đáp án đúng: <span className="whitespace-pre-wrap">{q.correct_answer}</span>
            </p>
          </article>
        ))}
      </section>
      <div className="mt-6 flex gap-4">
        <Link className="underline" href="/quiz">
          Làm bài mới
        </Link>
        <Link className="underline" href="/history">
          Lịch sử
        </Link>
      </div>
    </main>
  );
}
