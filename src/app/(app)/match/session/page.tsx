import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { MatchSession } from "@/features/match/components/match-session";
import { MATCH_QUESTION_COUNTS } from "@/features/match/types/match-types";

export const metadata: Metadata = { title: "Phiên Match" };

function parseCount(value: string | string[] | undefined): 12 | 18 | 24 | null {
  if (typeof value !== "string") return null;
  const num = Number(value);
  return MATCH_QUESTION_COUNTS.includes(num as never) ? (num as 12 | 18 | 24) : null;
}

export default async function MatchSessionPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>) {
  const raw = await searchParams;
  const questionCount = parseCount(raw.count);
  if (!questionCount) redirect("/match");

  const all = raw.all === "1";
  const setIds = typeof raw.sets === "string" ? raw.sets.split(",").filter(Boolean) : [];
  const collectionIds =
    typeof raw.collections === "string" ? raw.collections.split(",").filter(Boolean) : [];

  if (!all && setIds.length === 0 && collectionIds.length === 0) redirect("/match");

  const sessionHref = `/match/session${buildQuery({ all, setIds, collectionIds, count: questionCount })}`;

  return (
    <main className="mx-auto w-full max-w-3xl p-3 sm:p-8">
      <MatchSession sessionHref={sessionHref} questionCount={questionCount} />
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
