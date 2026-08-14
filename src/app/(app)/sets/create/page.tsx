import type { Metadata } from "next";
import Link from "next/link";

import {
  CreateSourceChips,
  type CreateSource,
} from "@/features/flashcard-sets/components/create-source-chips";
import { ManualSetForm } from "@/features/flashcard-sets/components/manual-set-form";
import { FileImport } from "@/features/imports/components/file-import";
import { GoogleSheetsImport } from "@/features/imports/components/google-sheets-import";
import { PasteImport } from "@/features/imports/components/paste-import";
import type { RouteSearchParams } from "@/lib/pagination";

export const metadata: Metadata = { title: "Tạo Flash card" };

function sourceOf(value: string | string[] | undefined): CreateSource {
  if (value === "google_sheets") return "google_sheets";
  if (value === "file") return "file";
  if (value === "manual") return "manual";
  return "paste";
}

export default async function CreateSetPage({
  searchParams,
}: Readonly<{ searchParams: Promise<RouteSearchParams> }>) {
  const raw = await searchParams;
  const source = sourceOf(raw.source);

  return (
    <main className="mx-auto w-full max-w-4xl p-3 sm:p-8">
      <Link className="text-sm underline" href="/sets" scroll={false}>
        ← Bộ flashcard
      </Link>
      <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Tạo Flash card</h1>

      <CreateSourceChips current={source} />

      <div className="mt-4">
        {source === "paste" ? <PasteImport /> : null}
        {source === "google_sheets" ? <GoogleSheetsImport /> : null}
        {source === "file" ? <FileImport /> : null}
        {source === "manual" ? <ManualSetForm /> : null}
      </div>
    </main>
  );
}
