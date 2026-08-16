import type { Metadata } from "next";

import { BackButton } from "@/components/shared/back-button";
import {
  CreateSourceChips,
  type CreateSource,
} from "@/features/flashcard-sets/components/create-source-chips";
import { ManualSetForm } from "@/features/flashcard-sets/components/manual-set-form";
import { FileImport } from "@/features/imports/components/file-import";
import { GoogleSheetsImport } from "@/features/imports/components/google-sheets-import";
import { PasteImport } from "@/features/imports/components/paste-import";
import { loadMascotLevel } from "@/features/mascot/server/load-mascot-level";
import type { RouteSearchParams } from "@/lib/pagination";
import { createClient } from "@/lib/supabase/server";

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

  const supabase = await createClient();
  const mascotLevel = await loadMascotLevel(supabase);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 pb-20">
      <BackButton fallbackHref="/sets" />
      <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Tạo Flash card</h1>

      <CreateSourceChips current={source} />

      <div className="mt-4">
        {source === "paste" ? <PasteImport mascotLevel={mascotLevel} /> : null}
        {source === "google_sheets" ? <GoogleSheetsImport mascotLevel={mascotLevel} /> : null}
        {source === "file" ? <FileImport mascotLevel={mascotLevel} /> : null}
        {source === "manual" ? <ManualSetForm /> : null}
      </div>
    </div>
  );
}
