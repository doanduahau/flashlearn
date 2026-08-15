import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SessionExitButton } from "@/features/learning-modes/components/session-exit-button";
import { MemorySession } from "@/features/memory/components/memory-session";
import { MEMORY_QUESTION_COUNTS } from "@/features/memory/types/memory-types";
import { loadMascotLevel } from "@/features/mascot/server/load-mascot-level";
import { studyModeHrefFromSession } from "@/features/study/utils/study-mode-href";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Phiên Memory" };

function parseCount(value: string | string[] | undefined): 12 | 18 | 24 | null {
  if (typeof value !== "string") return null;
  const num = Number(value);
  return MEMORY_QUESTION_COUNTS.includes(num as never) ? (num as 12 | 18 | 24) : null;
}

export default async function MemorySessionPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>) {
  const raw = await searchParams;
  const questionCount = parseCount(raw.count);
  if (!questionCount) redirect("/memory");

  const all = raw.all === "1";
  const setIds = typeof raw.sets === "string" ? raw.sets.split(",").filter(Boolean) : [];
  const collectionIds =
    typeof raw.collections === "string" ? raw.collections.split(",").filter(Boolean) : [];

  if (!all && setIds.length === 0 && collectionIds.length === 0) redirect("/memory");

  const supabase = await createClient();
  const mascotLevel = await loadMascotLevel(supabase);
  const sessionHref = `/memory/session${buildQuery({ all, setIds, collectionIds, count: questionCount })}`;
  const exitHref = studyModeHrefFromSession(sessionHref);

  return (
    <main className="mx-auto w-full max-w-3xl p-3 sm:p-8">
      <SessionExitButton fallbackHref={exitHref} className="mb-3" />
      <MemorySession
        sessionHref={sessionHref}
        questionCount={questionCount}
        exitHref={exitHref}
        mascotLevel={mascotLevel}
      />
    </main>
  );
}

function buildQuery(params: {
  all: boolean;
  setIds: string[];
  collectionIds: string[];
  count: number;
}): string {
  const query = new URLSearchParams();
  if (params.all) query.set("all", "1");
  if (params.setIds.length) query.set("sets", params.setIds.join(","));
  if (params.collectionIds.length) query.set("collections", params.collectionIds.join(","));
  query.set("count", String(params.count));
  const search = query.toString();
  return search ? `?${search}` : "";
}
