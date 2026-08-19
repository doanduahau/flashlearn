import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { BackButton } from "@/components/shared/back-button";
import { OfflineBanner } from "@/components/shared/offline-banner";
import { InstallCatalogButton } from "@/features/catalog/components/install-catalog-button";
import { catalogSetIdSchema } from "@/features/catalog/schemas/catalog-schema";
import { createClient } from "@/lib/supabase/server";
import { getFeatureFlags } from "@/lib/telemetry/feature-flags";

export const metadata: Metadata = { title: "Xem trước bộ thư viện" };

export default async function CatalogPreviewPage({
  params,
}: Readonly<{ params: Promise<{ catalogSetId: string }> }>) {
  if (!getFeatureFlags().catalogEnabled) redirect("/sets");
  const parsed = catalogSetIdSchema.safeParse((await params).catalogSetId);
  if (!parsed.success) notFound();
  const supabase = await createClient();
  const [{ data: set }, { data: cards }, { data: install }] = await Promise.all([
    supabase
      .from("catalog_sets")
      .select(
        "id,title,description,language_front,language_back,level,catalog_categories(name),catalog_cards(count)",
      )
      .eq("id", parsed.data)
      .eq("status", "published")
      .maybeSingle(),
    supabase
      .from("catalog_cards")
      .select("id,front,back,position")
      .eq("catalog_set_id", parsed.data)
      .order("position")
      .limit(8),
    supabase
      .from("user_catalog_installs")
      .select("installed_set_id,status")
      .eq("catalog_set_id", parsed.data)
      .eq("status", "active")
      .maybeSingle(),
  ]);
  if (!set) notFound();
  const cardCount = set.catalog_cards[0]?.count ?? 0;

  return (
    <main className="mx-auto w-full max-w-4xl p-3 sm:p-8">
      <OfflineBanner />
      <BackButton href="/sets/catalog" />
      <div className="mt-2 rounded-3xl border border-border-soft bg-surface p-5 sm:p-8">
        <p className="text-sm font-medium text-primary-foreground">{set.catalog_categories.name}</p>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">{set.title}</h1>
        <p className="mt-3 text-text-secondary">{set.description}</p>
        <p className="mt-3 text-sm text-text-secondary">
          {cardCount} thẻ · {set.language_front.toUpperCase()} → {set.language_back.toUpperCase()}
          {set.level ? ` · ${set.level === "beginner" ? "Cơ bản" : set.level}` : ""}
        </p>
        <div className="mt-5">
          <InstallCatalogButton
            catalogSetId={set.id}
            installedSetId={install?.installed_set_id ?? null}
          />
        </div>
      </div>
      <section className="mt-6" aria-labelledby="sample-heading">
        <h2 id="sample-heading" className="text-lg font-bold">
          Xem trước {Math.min(8, cardCount)} thẻ
        </h2>
        <ol className="mt-3 grid gap-3 sm:grid-cols-2">
          {(cards ?? []).map((card) => (
            <li key={card.id} className="rounded-2xl border border-border-soft bg-surface p-4">
              <p className="font-semibold">{card.front}</p>
              <p className="mt-2 border-t border-border-soft pt-2 text-text-secondary">
                {card.back}
              </p>
            </li>
          ))}
        </ol>
        {cardCount > 8 ? (
          <p className="mt-3 text-sm text-text-secondary">
            Thêm bộ để xem và sử dụng đầy đủ {cardCount} thẻ.
          </p>
        ) : null}
      </section>
    </main>
  );
}
