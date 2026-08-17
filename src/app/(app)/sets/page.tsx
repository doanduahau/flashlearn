import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { OfflineBanner } from "@/components/shared/offline-banner";
import { SetLauncherCard } from "@/features/flashcard-sets/components/set-launcher-card";
import { loadMascotLevel } from "@/features/mascot/server/load-mascot-level";
import type { RouteSearchParams } from "@/lib/pagination";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Bộ flashcard" };

function buildQuery(raw: RouteSearchParams): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined) continue;

    if (Array.isArray(value)) {
      for (const item of value) params.append(key, item);
    } else {
      params.append(key, value);
    }
  }

  return params.toString();
}

function redirectForLegacyParams(raw: RouteSearchParams) {
  const create = raw.create;

  if (typeof create === "string") {
    if (create === "import" || create === "document") redirect("/sets/create?source=file");
    if (create === "paste") redirect("/sets/create");
    if (create === "google_sheets") redirect("/sets/create?source=google_sheets");
    if (create === "manual") redirect("/sets/create?source=manual");
    redirect("/sets/create");
  }

  const hasLibraryParam = ["tab", "reorder", "q", "page"].some((key) => raw[key] !== undefined);
  if (hasLibraryParam) {
    const query = buildQuery(raw);
    redirect(query ? `/sets/library?${query}` : "/sets/library");
  }
}

export default async function SetsPage({
  searchParams,
}: Readonly<{ searchParams: Promise<RouteSearchParams> }>) {
  const raw = await searchParams;
  redirectForLegacyParams(raw);

  const supabase = await createClient();
  const mascotLevel = await loadMascotLevel(supabase);

  return (
    <main className="mx-auto w-full max-w-4xl p-3 sm:p-8">
      <OfflineBanner />
      <h1 className="text-2xl font-bold sm:text-3xl">Bộ flashcard</h1>
      <div className="mt-4 grid min-h-[calc(100dvh-16rem)] grid-rows-2 gap-4 sm:mt-6 sm:min-h-0 sm:grid-cols-2 sm:grid-rows-none sm:items-stretch">
        <SetLauncherCard
          href="/sets/create"
          mascotState="point-right"
          title="Tạo Flash card"
          description="Biến nội dung của bạn thành thẻ học"
          mascotLevel={mascotLevel}
        />
        <SetLauncherCard
          href="/sets/library"
          mascotState="normal"
          title="Flash card của bạn"
          description="Bộ thường và bộ đặc biệt"
          mascotLevel={mascotLevel}
        />
      </div>
    </main>
  );
}
