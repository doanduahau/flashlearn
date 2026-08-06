import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CardCollectionsControl } from "@/features/special-collections/components/card-collections-control";
import { buildQuizResultCollectionTargets } from "@/features/quiz/utils/result-collection-targets";
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
    .select(
      "id, position, prompt, correct_answer, choices, selected_choice_index, is_correct, flashcard_id",
    )
    .eq("session_id", sessionId)
    .order("position");

  const cardIds = Array.from(
    new Set(
      (questions ?? [])
        .filter((question) => question.flashcard_id !== null)
        .map((question) => question.flashcard_id as string),
    ),
  );

  const [collectionsResult, membershipsResult, cardsResult] = await Promise.all([
    supabase.from("special_collections").select("id, name").order("name", { ascending: true }),
    cardIds.length
      ? supabase
          .from("special_collection_items")
          .select("collection_id, flashcard_id")
          .in("flashcard_id", cardIds)
      : Promise.resolve({ data: [] as { collection_id: string; flashcard_id: string }[] }),
    cardIds.length
      ? supabase.from("flashcards").select("id, set_id").in("id", cardIds)
      : Promise.resolve({ data: [] as { id: string; set_id: string }[] }),
  ]);

  const collections = (collectionsResult.data ?? []).map((collection) => ({
    id: collection.id,
    name: collection.name,
  }));
  const membershipsByCard: Record<string, string[]> = {};
  for (const item of membershipsResult.data ?? []) {
    (membershipsByCard[item.flashcard_id] ??= []).push(item.collection_id);
  }
  const setByCard: Record<string, string> = {};
  for (const card of cardsResult.data ?? []) {
    setByCard[card.id] = card.set_id;
  }

  const targets = buildQuizResultCollectionTargets({
    questions: questions ?? [],
    collections,
    membershipsByCard,
    setByCard,
  });

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
        {(questions ?? []).map((q) => {
          const target = targets.get(q.id);
          return (
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
              {target ? (
                target.kind === "save" ? (
                  <div className="mt-4">
                    <CardCollectionsControl
                      cardId={target.flashcardId}
                      setId={target.setId}
                      collections={target.collections}
                      memberships={target.memberships}
                      label="Thêm vào bộ đặc biệt"
                    />
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-text-secondary">
                    Thẻ gốc đã bị xóa nên không thể thêm vào bộ đặc biệt.
                  </p>
                )
              ) : null}
            </article>
          );
        })}
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
