import type { Metadata } from "next";
import { Suspense } from "react";

import { PaginationControls } from "@/components/shared/pagination-controls";
import { SectionTabs } from "@/components/shared/section-tabs";
import { LibrarySearchForm } from "@/features/flashcard-sets/components/library-search-form";
import { SetsList, type SetSummary } from "@/features/flashcard-sets/components/sets-list";
import { sanitizeSearchQuery } from "@/features/flashcard-sets/utils/search";
import {
  CollectionsList,
  type CollectionSummary,
} from "@/features/special-collections/components/collections-list";
import { CreateCollectionForm } from "@/features/special-collections/components/create-collection-form";
import { LIBRARY_PAGE_SIZE } from "@/lib/constants";
import {
  pageHref,
  parsePage,
  type RouteSearchParams,
  updateSearchParamHref,
} from "@/lib/pagination";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Bộ flashcard" };

type LibraryTab = "regular" | "special";

function tabOf(value: string | string[] | undefined): LibraryTab {
  return value === "special" ? "special" : "regular";
}

export default async function SetsPage({
  searchParams,
}: Readonly<{ searchParams: Promise<RouteSearchParams> }>) {
  const raw = await searchParams;
  const tab = tabOf(raw.tab);
  const tabs = [
    {
      value: "regular",
      label: "Bộ thường",
      href: updateSearchParamHref("/sets", raw, "tab", "regular"),
    },
    {
      value: "special",
      label: "Bộ đặc biệt",
      href: updateSearchParamHref("/sets", raw, "tab", "special"),
    },
  ];

  return (
    <main className="mx-auto w-full max-w-4xl p-4 sm:p-8">
      <h1 className="text-3xl font-bold">Bộ flashcard</h1>
      <SectionTabs
        label="Loại bộ flashcard"
        current={tab}
        items={tabs}
        pendingContent={<SetsTabLoading />}
      >
        <Suspense fallback={<SetsTabLoading />}>
          <SetsTabContent tab={tab} searchParams={raw} />
        </Suspense>
      </SectionTabs>
    </main>
  );
}

async function SetsTabContent({
  tab,
  searchParams,
}: Readonly<{
  tab: LibraryTab;
  searchParams: RouteSearchParams;
}>) {
  const query = sanitizeSearchQuery(typeof searchParams.q === "string" ? searchParams.q : "");
  const requestedPage = parsePage(searchParams.page);
  const supabase = await createClient();
  const title = tab === "regular" ? "Bộ thường" : "Bộ đặc biệt";
  const searchLabel = tab === "regular" ? "Tìm bộ thường" : "Tìm bộ đặc biệt";
  const placeholder = tab === "regular" ? "Tên bộ flashcard" : "Tên bộ đặc biệt";

  if (tab === "regular") {
    let countQuery = supabase.from("flashcard_sets").select("id", { count: "exact", head: true });
    let listQuery = supabase
      .from("flashcard_sets")
      .select("id, name, flashcards(count)")
      .order("created_at", { ascending: false });
    if (query) {
      countQuery = countQuery.ilike("name", `%${query}%`);
      listQuery = listQuery.ilike("name", `%${query}%`);
    }
    const { count } = await countQuery;
    const totalPages = Math.max(1, Math.ceil((count ?? 0) / LIBRARY_PAGE_SIZE));
    const page = Math.min(requestedPage, totalPages);
    const from = (page - 1) * LIBRARY_PAGE_SIZE;
    const { data } = await listQuery.range(from, from + LIBRARY_PAGE_SIZE - 1);
    const sets: SetSummary[] = (data ?? []).map((set) => ({
      id: set.id,
      name: set.name,
      cardCount: set.flashcards[0]?.count ?? 0,
    }));

    return (
      <section className="mt-6" aria-labelledby="sets-tab-heading">
        <h2 id="sets-tab-heading" className="text-xl font-bold">
          {title}
        </h2>
        <LibrarySearchForm defaultValue={query} label={searchLabel} placeholder={placeholder} />
        <SetsList sets={sets} hasSearch={Boolean(query)} />
        {totalPages > 1 ? (
          <PaginationControls
            page={page}
            totalPages={totalPages}
            pageHref={(target) => pageHref(searchParams, target)}
          />
        ) : null}
      </section>
    );
  }

  let countQuery = supabase
    .from("special_collections")
    .select("id", { count: "exact", head: true });
  let listQuery = supabase
    .from("special_collections")
    .select("id, name, special_collection_items(count)")
    .order("created_at", { ascending: false });
  if (query) {
    countQuery = countQuery.ilike("name", `%${query}%`);
    listQuery = listQuery.ilike("name", `%${query}%`);
  }
  const { count } = await countQuery;
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / LIBRARY_PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const from = (page - 1) * LIBRARY_PAGE_SIZE;
  const { data } = await listQuery.range(from, from + LIBRARY_PAGE_SIZE - 1);
  const collections: CollectionSummary[] = (data ?? []).map((collection) => ({
    id: collection.id,
    name: collection.name,
    cardCount: collection.special_collection_items[0]?.count ?? 0,
  }));

  return (
    <section className="mt-6" aria-labelledby="sets-tab-heading">
      <h2 id="sets-tab-heading" className="text-xl font-bold">
        {title}
      </h2>
      <p className="mt-2 text-text-secondary">
        Gom thẻ từ nhiều bộ flashcard thành bộ học theo chủ đề.
      </p>
      <section
        aria-label="Tạo bộ đặc biệt"
        className="mt-5 rounded-2xl border border-border-soft bg-surface p-5"
      >
        <h3 className="font-semibold">Tạo bộ đặc biệt</h3>
        <div className="mt-3 max-w-sm">
          <CreateCollectionForm />
        </div>
      </section>
      <LibrarySearchForm defaultValue={query} label={searchLabel} placeholder={placeholder} />
      <CollectionsList collections={collections} hasSearch={Boolean(query)} />
      {totalPages > 1 ? (
        <PaginationControls
          page={page}
          totalPages={totalPages}
          pageHref={(target) => pageHref(searchParams, target)}
        />
      ) : null}
    </section>
  );
}

function SetsTabLoading() {
  return (
    <section aria-label="Đang tải nội dung bộ flashcard" className="mt-6 space-y-4" role="status">
      <div className="h-7 w-40 animate-pulse rounded-lg bg-surface-subtle" />
      <div className="h-11 max-w-sm animate-pulse rounded-xl bg-surface-subtle" />
      <div className="h-28 animate-pulse rounded-2xl bg-surface-subtle" />
    </section>
  );
}
