import { notFound, redirect } from "next/navigation";
import { QuizSession } from "@/features/quiz/components/quiz-session";
import { createClient } from "@/lib/supabase/server";
export default async function QuizSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const supabase = await createClient();
  const { data: session } = await supabase
    .from("quiz_sessions")
    .select("id, actual_question_count, completed_at")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) notFound();
  if (session.completed_at) redirect(`/quiz/${sessionId}/result`);
  const { data: question } = await supabase
    .from("quiz_questions")
    .select("id, position, prompt, choices")
    .eq("session_id", sessionId)
    .is("answered_at", null)
    .order("position")
    .limit(1)
    .maybeSingle();
  if (!question) redirect(`/quiz/${sessionId}/result`);
  return (
    <QuizSession
      sessionId={sessionId}
      total={session.actual_question_count}
      question={{ ...question, choices: question.choices as string[] }}
    />
  );
}
