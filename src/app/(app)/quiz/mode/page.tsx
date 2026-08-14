import { redirect } from "next/navigation";

import { QuizModeSelect } from "@/features/quiz/components/quiz-mode-select";
import { getQuizEligibility } from "@/features/quiz/server/actions";
import { getMatchAvailability } from "@/features/match/server/actions";
import { createClient } from "@/lib/supabase/server";

type SearchParams = Record<string, string | string[] | undefined>;

function parseSource(raw: SearchParams): {
  all: boolean;
  setIds: string[];
  collectionIds: string[];
} {
  const all = raw.all === "1";
  const setIds =
    typeof raw.sets === "string" && raw.sets.length > 0 ? raw.sets.split(",").filter(Boolean) : [];
  const collectionIds =
    typeof raw.collections === "string" && raw.collections.length > 0
      ? raw.collections.split(",").filter(Boolean)
      : [];
  return { all, setIds, collectionIds };
}

function buildBackHref(source: {
  all: boolean;
  setIds: string[];
  collectionIds: string[];
}): string {
  const q = new URLSearchParams();
  if (source.all) q.set("all", "1");
  if (source.setIds.length) q.set("sets", source.setIds.join(","));
  if (source.collectionIds.length) q.set("collections", source.collectionIds.join(","));
  const qs = q.toString();
  return qs ? `/quiz?${qs}` : "/quiz";
}

export default async function QuizModePage({
  searchParams,
}: Readonly<{ searchParams: Promise<SearchParams> }>) {
  const raw = await searchParams;
  const source = parseSource(raw);

  // Must have either all=1 or at least one source
  if (!source.all && source.setIds.length === 0 && source.collectionIds.length === 0) {
    redirect("/quiz");
  }

  // Load both eligibility results in parallel — server side, no client calls needed
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect("/sign-in");

  const [quizResult, matchResult] = await Promise.all([
    getQuizEligibility(source),
    getMatchAvailability({ ...source, questionCount: 12, filter: "random" }),
  ]);

  const quizTotal = quizResult.ok ? quizResult.total : 0;
  const quizWrong = quizResult.ok ? quizResult.wrong : 0;
  const quizUncovered = quizResult.ok ? quizResult.uncovered : 0;
  const matchEligible = matchResult.ok ? matchResult.eligibleCount : 0;
  const matchAvailableCounts = matchResult.ok ? matchResult.eligibility.availableCounts : [];

  return (
    <main className="mx-auto flex h-full w-full max-w-4xl flex-col p-3 sm:p-8">
      <QuizModeSelect
        source={source}
        quizTotal={quizTotal}
        quizWrong={quizWrong}
        quizUncovered={quizUncovered}
        matchEligible={matchEligible}
        matchAvailableCounts={matchAvailableCounts}
        backHref={buildBackHref(source)}
      />
    </main>
  );
}
