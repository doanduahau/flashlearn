import type { Metadata } from "next";
import { ListOrdered } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { BackButton } from "@/components/shared/back-button";
import { BrandLoading } from "@/components/shared/brand-loading";
import { OfflineBanner } from "@/components/shared/offline-banner";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { SectionTabs } from "@/components/shared/section-tabs";
import { Button } from "@/components/ui/button";
import { LibrarySearchForm } from "@/features/flashcard-sets/components/library-search-form";
import { SetReorderList } from "@/features/flashcard-sets/components/set-reorder-list";
import { SetsList, type SetSummary } from "@/features/flashcard-sets/components/sets-list";
import { sanitizeSearchQuery } from "@/features/flashcard-sets/utils/search";
import { loadMascotLevel } from "@/features/mascot/server/load-mascot-level";
import {
  CollectionsList,
  type CollectionSummary,
} from "@/features/special-collections/components/collections-list";
import { CreateCollectionToggle } from "@/features/special-collections/components/create-collection-toggle";
import { LIBRARY_PAGE_SIZE } from "@/lib/constants";
import {
  pageHref,
  parsePage,
  type RouteSearchParams,
  updateSearchParamHref,
} from "@/lib/pagination";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Flash card của bạn" };

type LibraryTab = "regular" | "special";

function tabOf(value: string | string[] | undefined): LibraryTab {
  return value === "special" ? "special" : "regular";
}

export default async function LibraryPage({
  searchParams,
}: Readonly<{ searchParams: Promise<RouteSearchParams> }>) {
  const raw = await searchParams;
  const tab = tabOf(raw.tab);
  const tabs = [
    {
      value: "regular",
      label: "Bộ thường",
      href: updateSearchParamHref("/sets/library", raw, "tab", "regular"),
    },
    {
      value: "special",
      label: "Bộ đặc biệt",
      href: updateSearchParamHref("/sets/library", raw, "tab", "special"),
    },
  ];

  return (
    <main className="mx-auto w-full max-w-4xl p-3 sm:p-8">
      <OfflineBanner />
      <BackButton href="/sets" />
      <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Flash card của bạn</h1>
      <div className="mt-3 sm:mt-5">
        <SectionTabs
          label="Loại bộ flashcard"
          current={tab}
          items={tabs}
          pendingContent={<LibraryTabLoading />}
        >
          <Suspense fallback={<LibraryTabLoading />}>
            <LibraryTabContent tab={tab} searchParams={raw} />
          </Suspense>
        </SectionTabs>
      </div>
    </main>
  );
}

async function LibraryTabContent({
  tab,
  searchParams,
}: Readonly<{
  tab: LibraryTab;
  searchParams: RouteSearchParams;
}>) {
  const query = sanitizeSearchQuery(typeof searchParams.q === "string" ? searchParams.q : "");
  const requestedPage = parsePage(searchParams.page);
  const isReordering = searchParams.reorder === "1";
  const supabase = await createClient();
  const mascotLevel = await loadMascotLevel(supabase);
  const searchLabel = tab === "regular" ? "Tìm bộ thường" : "Tìm bộ đặc biệt";
  const placeholder = tab === "regular" ? "Tên bộ flashcard" : "Tên bộ đặc biệt";

  if (tab === "regular") {
    if (isReordering) {
      const { data } = await supabase
        .from("flashcard_sets")
        .select("id, name, flashcards(count)")
        .order("sort_order", { ascending: true })
        .order("id", { ascending: true });
      const doneHref = updateSearchParamHref(
        "/sets/library",
        { ...searchParams, reorder: undefined },
        "tab",
        "regular",
      );

      return (
        <SetReorderList
          initialSets={(data ?? []).map((set) => ({
            id: set.id,
            name: set.name,
            cardCount: set.flashcards[0]?.count ?? 0,
          }))}
          doneHref={doneHref}
          mascotLevel={mascotLevel}
        />
      );
    }

    let countQuery = supabase.from("flashcard_sets").select("id", { count: "exact", head: true });
    let listQuery = supabase
      .from("flashcard_sets")
      .select("id, name, flashcards(count)")
      .order("created_at", { ascending: false })
      .order("id", { ascending: true });
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
      <section className="mt-3 sm:mt-5" aria-label="Danh sách bộ thường">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold sm:text-lg">Bộ thường</h3>
          <Button asChild variant="outline" size="sm" className="min-h-9 sm:min-h-10">
            <Link
              href={updateSearchParamHref("/sets/library", searchParams, "reorder", "1")}
              scroll={false}
            >
              <ListOrdered aria-hidden="true" />
              Sắp xếp
            </Link>
          </Button>
        </div>
        <LibrarySearchForm defaultValue={query} label={searchLabel} placeholder={placeholder} />
        <SetsList sets={sets} hasSearch={Boolean(query)} mascotLevel={mascotLevel} />
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
    .order("created_at", { ascending: false })
    .order("id", { ascending: true });
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
    <section className="mt-3 sm:mt-5" aria-label="Danh sách bộ đặc biệt">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold sm:text-lg">Bộ đặc biệt</h3>
        <CreateCollectionToggle />
      </div>
      <LibrarySearchForm defaultValue={query} label={searchLabel} placeholder={placeholder} />
      <CollectionsList
        collections={collections}
        hasSearch={Boolean(query)}
        mascotLevel={mascotLevel}
      />
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

function LibraryTabLoading() {
  return <BrandLoading title="Đang tải nội dung bộ flashcard" />;
}
