import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { OfflineBanner } from "@/components/shared/offline-banner";
import { StarterOnboardingBanner } from "@/features/catalog/components/starter-onboarding-banner";
import { claimStarterOnboardingBanner } from "@/features/catalog/server/onboarding";
import { SetLauncherCard } from "@/features/flashcard-sets/components/set-launcher-card";
import { loadMascotLevel } from "@/features/mascot/server/load-mascot-level";
import type { RouteSearchParams } from "@/lib/pagination";
import { createClient } from "@/lib/supabase/server";
import { getFeatureFlags } from "@/lib/telemetry/feature-flags";

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
  const [mascotLevel, claimsResult] = await Promise.all([
    loadMascotLevel(supabase),
    supabase.auth.getClaims(),
  ]);
  const flags = getFeatureFlags();
  const showOnboarding =
    flags.starterProvisioningEnabled && claimsResult.data?.claims.sub
      ? await claimStarterOnboardingBanner(claimsResult.data.claims.sub)
      : false;

  return (
    <main className="mx-auto w-full max-w-4xl p-3 sm:p-8">
      <OfflineBanner />
      <h1 className="text-2xl font-bold sm:text-3xl">Bộ flashcard</h1>
      {showOnboarding ? <StarterOnboardingBanner /> : null}
      <div className="mt-4 grid gap-4 sm:mt-6 sm:grid-cols-2 sm:items-stretch lg:grid-cols-3">
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
        {flags.catalogEnabled ? (
          <SetLauncherCard
            href="/sets/catalog"
            mascotState="normal"
            title="Thư viện Flashcard"
            description="Khám phá các bộ do CapyStudy chuẩn bị"
            mascotLevel={mascotLevel}
          />
        ) : null}
      </div>
    </main>
  );
}
