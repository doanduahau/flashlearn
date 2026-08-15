import { redirect } from "next/navigation";

import { StudyModeSelect } from "@/features/study/components/study-mode-select";
import { loadMascotLevel } from "@/features/mascot/server/load-mascot-level";
import { collectStudyCardIds } from "@/features/study/server/load-study-cards";
import { parseStudySessionParams } from "@/features/study/schemas/study-schema";
import { createClient } from "@/lib/supabase/server";

export default async function StudyModePage({
  searchParams,
}: Readonly<{ searchParams: Promise<Record<string, string | string[] | undefined>> }>) {
  const source = parseStudySessionParams(await searchParams);
  if (!source) redirect("/study");
  const supabase = await createClient();
  const cardIds = await collectStudyCardIds(supabase, source);
  const mascotLevel = await loadMascotLevel(supabase);
  return (
    <main className="mx-auto flex h-full w-full max-w-4xl flex-col p-3 sm:p-8">
      <StudyModeSelect source={source} totalCards={cardIds.length} mascotLevel={mascotLevel} />
    </main>
  );
}
