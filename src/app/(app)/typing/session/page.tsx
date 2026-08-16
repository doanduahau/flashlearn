import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { loadMascotLevel } from "@/features/mascot/server/load-mascot-level";
import { TypingSession } from "@/features/typing/components/typing-session";
import {
  TYPING_MAX_QUESTIONS,
  TYPING_MIN_QUESTIONS,
} from "@/features/typing/schemas/typing-schema";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Phiên Nhập đáp án" };

function parseCount(value: string | string[] | undefined): number | null {
  if (typeof value !== "string") return null;
  const num = Number(value);
  if (!Number.isInteger(num)) return null;
  return num >= TYPING_MIN_QUESTIONS && num <= TYPING_MAX_QUESTIONS ? num : null;
}

export default async function TypingSessionPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>) {
  const raw = await searchParams;
  const questionCount = parseCount(raw.count);
  if (!questionCount) redirect("/quiz/mode");

  const all = raw.all === "1";
  const setIds = typeof raw.sets === "string" ? raw.sets.split(",").filter(Boolean) : [];
  const collectionIds =
    typeof raw.collections === "string" ? raw.collections.split(",").filter(Boolean) : [];

  if (!all && setIds.length === 0 && collectionIds.length === 0) redirect("/quiz/mode");

  const supabase = await createClient();
  const mascotLevel = await loadMascotLevel(supabase);
  const sessionHref = `/typing/session${buildQuery({ all, setIds, collectionIds, count: questionCount })}`;
  const exitHref = `/quiz/mode${buildSourceQuery({ all, setIds, collectionIds })}`;

  return (
    <main className="mx-auto w-full max-w-3xl p-3 sm:p-8">
      <TypingSession
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
  return `?${query.toString()}`;
}

function buildSourceQuery(params: {
  all: boolean;
  setIds: string[];
  collectionIds: string[];
}): string {
  const query = new URLSearchParams();
  if (params.all) query.set("all", "1");
  if (params.setIds.length) query.set("sets", params.setIds.join(","));
  if (params.collectionIds.length) query.set("collections", params.collectionIds.join(","));
  const search = query.toString();
  return search ? `?${search}` : "";
}
