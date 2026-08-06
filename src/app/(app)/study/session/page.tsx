import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { StudySession } from "@/features/study/components/study-session";
import { loadStudySession } from "@/features/study/server/load-study-session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Phiên học" };

export default async function StudySessionPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>) {
  const raw = await searchParams;
  const supabase = await createClient();
  const session = await loadStudySession(supabase, raw);
  if (!session) redirect("/study");

  const orderKey = session.params.seed !== undefined ? `seed-${session.params.seed}` : "ordered";

  return (
    <StudySession
      key={orderKey}
      cards={session.cards}
      collections={session.collections}
      membershipsByCard={session.membershipsByCard}
      truncated={session.truncated}
      seed={session.params.seed}
      sessionHref={session.sessionHref}
    />
  );
}
