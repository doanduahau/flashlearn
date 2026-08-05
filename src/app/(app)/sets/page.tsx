import Link from "next/link";
import type { Metadata } from "next";

import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Bộ flashcard" };

export default async function SetsPage() {
  const supabase = await createClient();
  const { data: sets } = await supabase
    .from("flashcard_sets")
    .select("id, name, created_at")
    .order("created_at", { ascending: false });
  return (
    <main className="mx-auto w-full max-w-4xl p-4 sm:p-8">
      <h1 className="text-3xl font-bold">Bộ flashcard</h1>
      {sets?.length ? (
        <ul className="mt-6 grid gap-3">
          {sets.map((set) => (
            <li key={set.id}>
              <Link
                className="block rounded-2xl border border-border-soft bg-surface p-5 hover:bg-surface-subtle"
                href={`/sets/${set.id}`}
              >
                {set.name}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 text-text-secondary">
          Chưa có bộ flashcard.{" "}
          <Link className="underline" href="/import">
            Import tệp đầu tiên
          </Link>
          .
        </p>
      )}
    </main>
  );
}
