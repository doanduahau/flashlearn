import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { loadMascotLevel } from "@/features/mascot/server/load-mascot-level";
import { RunnerSession } from "@/features/runner/components/runner-session";
import type { RunnerDifficulty } from "@/features/runner/types/runner-types";
import { mapRunnerSessionRows } from "@/features/runner/utils/map-runner-session-payload";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Phiên Runner" };

const RUNNER_DIFFICULTIES: readonly RunnerDifficulty[] = ["easy", "medium", "hard"];

export default async function RunnerSessionPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>) {
  const raw = await searchParams;
  const sessionId = typeof raw.sessionId === "string" ? raw.sessionId : "";
  if (!sessionId) redirect("/runner");

  const supabase = await createClient();

  const { data: sessionRow, error: sessionError } = await supabase
    .from("runner_sessions")
    .select("difficulty")
    .eq("id", sessionId)
    .maybeSingle();
  if (sessionError || !sessionRow) redirect("/runner");

  if (!RUNNER_DIFFICULTIES.includes(sessionRow.difficulty as RunnerDifficulty)) {
    redirect("/runner");
  }
  const difficulty = sessionRow.difficulty as RunnerDifficulty;

  const { data, error } = await supabase.rpc("load_runner_session_questions", {
    p_runner_session_id: sessionId,
  });
  if (error) {
    return <SessionError />;
  }

  let questions;
  try {
    questions = mapRunnerSessionRows(data);
  } catch {
    return <SessionError />;
  }

  const mascotLevel = await loadMascotLevel(supabase);

  return <RunnerSession questions={questions} difficulty={difficulty} mascotLevel={mascotLevel} />;
}

function SessionError() {
  return (
    <main className="mx-auto w-full max-w-3xl p-3 sm:p-8">
      <h1 className="text-2xl font-bold sm:text-3xl">Capy Runner</h1>
      <p
        role="alert"
        className="mt-4 rounded-2xl border border-border-soft bg-surface p-4 text-danger"
      >
        Không thể tải câu hỏi của phiên Runner lúc này. Vui lòng thử lại.
      </p>
    </main>
  );
}
