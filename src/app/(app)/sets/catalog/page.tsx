import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { BackButton } from "@/components/shared/back-button";
import { OfflineBanner } from "@/components/shared/offline-banner";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { CatalogFilterForm } from "@/features/catalog/components/catalog-filter-form";
import {
  CatalogSetCard,
  type CatalogSetSummary,
} from "@/features/catalog/components/catalog-set-card";
import { parseCatalogFilters } from "@/features/catalog/schemas/catalog-schema";
import { CATALOG_PAGE_SIZE } from "@/lib/constants";
import { pageHref, parsePage, type RouteSearchParams } from "@/lib/pagination";
import { createClient } from "@/lib/supabase/server";
import { getFeatureFlags } from "@/lib/telemetry/feature-flags";

export const metadata: Metadata = { title: "Thư viện Flashcard" };

export default async function CatalogPage({
  searchParams,
}: Readonly<{ searchParams: Promise<RouteSearchParams> }>) {
  if (!getFeatureFlags().catalogEnabled) redirect("/sets");
  const raw = await searchParams;
  const filters = parseCatalogFilters(raw);
  const requestedPage = parsePage(raw.page);
  const supabase = await createClient();

  const { data: categories } = await supabase
    .from("catalog_categories")
    .select("id, slug, name")
    .eq("active", true)
    .order("sort_order");
  const categoryId = categories?.find((item) => item.slug === filters.category)?.id;
  const searchPattern = filters.q.replaceAll("%", "\\%").replaceAll("_", "\\_");
  let countQuery = supabase
    .from("catalog_sets")
    .select("id", { count: "exact", head: true })
    .eq("status", "published");
  let listQuery = supabase
    .from("catalog_sets")
    .select(
      "id,title,description,language_front,language_back,level,is_starter,starter_order,category_id,catalog_categories(name),catalog_cards(count)",
    )
    .eq("status", "published")
    .order("starter_order", { ascending: true, nullsFirst: false })
    .order("title");
  if (filters.q) {
    countQuery = countQuery.ilike("title", `%${searchPattern}%`);
    listQuery = listQuery.ilike("title", `%${searchPattern}%`);
  }
  if (categoryId) {
    countQuery = countQuery.eq("category_id", categoryId);
    listQuery = listQuery.eq("category_id", categoryId);
  } else if (filters.category) {
    countQuery = countQuery.eq("category_id", "00000000-0000-0000-0000-000000000000");
    listQuery = listQuery.eq("category_id", "00000000-0000-0000-0000-000000000000");
  }
  if (filters.language) {
    const [front, back] = filters.language.split("-");
    countQuery = countQuery.eq("language_front", front).eq("language_back", back);
    listQuery = listQuery.eq("language_front", front).eq("language_back", back);
  }
  if (filters.level) {
    countQuery = countQuery.eq("level", filters.level);
    listQuery = listQuery.eq("level", filters.level);
  }
  const { count } = await countQuery;
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / CATALOG_PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const from = (page - 1) * CATALOG_PAGE_SIZE;
  const { data: rows, error } = await listQuery.range(from, from + CATALOG_PAGE_SIZE - 1);
  if (error) throw new Error("catalog_list_failed");
  const ids = (rows ?? []).map((row) => row.id);
  const { data: installs } = ids.length
    ? await supabase
        .from("user_catalog_installs")
        .select("catalog_set_id,installed_set_id,status")
        .in("catalog_set_id", ids)
        .eq("status", "active")
    : { data: [] };
  const installedIds = new Set(
    (installs ?? []).filter((item) => item.installed_set_id).map((item) => item.catalog_set_id),
  );
  const sets: CatalogSetSummary[] = (rows ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    categoryName: row.catalog_categories.name,
    languageFront: row.language_front,
    languageBack: row.language_back,
    level: row.level,
    cardCount: row.catalog_cards[0]?.count ?? 0,
    isStarter: row.is_starter,
    installed: installedIds.has(row.id),
  }));

  return (
    <main className="mx-auto w-full max-w-6xl p-3 sm:p-8">
      <OfflineBanner />
      <BackButton href="/sets" />
      <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Thư viện Flashcard</h1>
      <p className="mt-2 text-text-secondary">
        Chọn các bộ do CapyStudy chuẩn bị và thêm bản sao vào thư viện của bạn.
      </p>
      <CatalogFilterForm
        query={filters.q}
        category={filters.category}
        language={filters.language}
        level={filters.level}
        categories={(categories ?? []).map((item) => ({ value: item.slug, label: item.name }))}
      />
      <section className="mt-6" aria-labelledby="catalog-results">
        <h2 id="catalog-results" className="text-lg font-bold">
          {filters.q || filters.category || filters.language || filters.level
            ? "Kết quả"
            : "Bộ khởi đầu"}
        </h2>
        {sets.length ? (
          <ul className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sets.map((set) => (
              <CatalogSetCard key={set.id} set={set} />
            ))}
          </ul>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-border-soft p-6 text-text-secondary">
            Không tìm thấy bộ flashcard phù hợp. Hãy thử xóa bớt bộ lọc.
          </div>
        )}
      </section>
      {totalPages > 1 ? (
        <PaginationControls
          page={page}
          totalPages={totalPages}
          pageHref={(target) => pageHref(raw, target)}
        />
      ) : null}
    </main>
  );
}
