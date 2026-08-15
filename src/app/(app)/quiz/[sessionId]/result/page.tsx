import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Flame } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { CardCollectionsControl } from "@/features/special-collections/components/card-collections-control";
import { countDueCards } from "@/features/spaced-repetition/server/due-repository";
import { countNewCards } from "@/features/spaced-repetition/server/new-cards-repository";
import { SmartReviewContinuation } from "@/features/smart-review/components/smart-review-continuation";
import { NewCardsContinuation } from "@/features/spaced-repetition/components/new-cards-continuation";
import { loadSmartReviewResultContext } from "@/features/smart-review/utils/smart-review-result";
import { loadStreakSummary } from "@/features/statistics/server/load-statistics";
import { streakLabel } from "@/features/statistics/utils/streak-label";
import { buildQuizResultCollectionTargets } from "@/features/quiz/utils/result-collection-targets";
import { quizSessionOrigin } from "@/features/quiz/utils/quiz-session-origin";
import { MascotImage } from "@/features/mascot/components/mascot-image";
import { levelFromStreak } from "@/features/mascot/utils/mascot-level";
import { createClient } from "@/lib/supabase/server";
export default async function QuizResultPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const supabase = await createClient();
  const [sessionResult, streakSummary, claimsResult] = await Promise.all([
    supabase
      .from("quiz_sessions")
      .select("mode, origin, actual_question_count, correct_answer_count, completed_at")
      .eq("id", sessionId)
      .maybeSingle(),
    loadStreakSummary(supabase),
    supabase.auth.getClaims(),
  ]);
  const session = sessionResult.data;
  if (!session) notFound();
  if (!session.completed_at) redirect(`/quiz/${sessionId}`);

  const userId =
    typeof claimsResult.data?.claims?.sub === "string" ? claimsResult.data.claims.sub : null;

  const [questionsResult, smartReviewResult] = await Promise.all([
    supabase
      .from("quiz_questions")
      .select(
        "id, position, prompt, correct_answer, choices, selected_choice_index, is_correct, flashcard_id",
      )
      .eq("session_id", sessionId)
      .order("position"),
    loadSmartReviewResultContext(
      quizSessionOrigin(session.origin),
      () => {
        if (!userId) return Promise.resolve({ total: 0 });
        const evalTime = new Date().toISOString();
        return countDueCards(supabase, userId, { type: "library" }, evalTime).then((total) => ({
          total,
        }));
      },
      () => {
        if (!userId) return Promise.resolve({ total: 0 });
        return countNewCards(supabase).then((total) => ({ total }));
      },
    ),
  ]);
  const questions = questionsResult.data;

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
      <div className="flex items-center gap-4">
        <MascotImage
          level={levelFromStreak(streakSummary?.currentStreak ?? 0)}
          state={percentage >= 60 ? "happy" : "sad"}
          size={80}
          className="size-16 shrink-0 object-contain sm:size-20"
        />
        <div>
          <h1 className="text-3xl font-bold">Kết quả kiểm tra</h1>
          <p className="mt-3 text-xl">
            {session.correct_answer_count}/{session.actual_question_count} đúng ({percentage}%)
          </p>
        </div>
      </div>
      {streakSummary ? (
        <section
          aria-label="Chuỗi học tập"
          className="mt-6 rounded-2xl border border-border-soft bg-primary-soft p-4 sm:p-5"
        >
          <div className="flex items-center gap-3">
            <Flame aria-hidden="true" className="size-6 shrink-0 text-achievement" />
            <div>
              <p className="font-semibold">
                {streakLabel(streakSummary.currentStreak, streakSummary.completedToday)}
              </p>
              {streakSummary.completedToday ? (
                <p className="text-sm text-text-secondary">
                  Bạn vừa hoàn thành một bài kiểm tra hôm nay. Giữ vững nhé!
                </p>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}
      {smartReviewResult.kind === "smart_review" ? (
        <SmartReviewContinuation remainingCount={smartReviewResult.remainingCount} />
      ) : smartReviewResult.kind === "new_cards" ? (
        <NewCardsContinuation remainingCount={smartReviewResult.remainingCount} />
      ) : null}
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
      <div className="mt-8 flex flex-wrap gap-3">
        {session.origin === "manual" ? (
          <Button asChild>
            <Link href="/quiz/mode">Thiết lập bài mới</Link>
          </Button>
        ) : null}
        <Button asChild variant={session.origin === "manual" ? "outline" : "default"}>
          <Link href="/dashboard">Về màn hình chính</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/profile?tab=statistics">Xem lịch sử</Link>
        </Button>
      </div>
    </main>
  );
}
