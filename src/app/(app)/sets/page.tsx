import type { Metadata } from "next";
import { ListOrdered } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { PaginationControls } from "@/components/shared/pagination-controls";
import { SectionTabs } from "@/components/shared/section-tabs";
import { Button } from "@/components/ui/button";
import { LibrarySearchForm } from "@/features/flashcard-sets/components/library-search-form";
import { SetReorderList } from "@/features/flashcard-sets/components/set-reorder-list";
import { SetsList, type SetSummary } from "@/features/flashcard-sets/components/sets-list";
import { sanitizeSearchQuery } from "@/features/flashcard-sets/utils/search";
import { ManualSetForm } from "@/features/flashcard-sets/components/manual-set-form";
import {
  CreateSetCard,
  type CreateMode,
} from "@/features/flashcard-sets/components/create-set-card";
import { LibraryCard } from "@/features/flashcard-sets/components/library-card";
import { FileImport } from "@/features/imports/components/file-import";
import { PasteImport } from "@/features/imports/components/paste-import";
import { GoogleSheetsImport } from "@/features/imports/components/google-sheets-import";
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

export const metadata: Metadata = { title: "Bộ flashcard" };

type LibraryTab = "regular" | "special";

function tabOf(value: string | string[] | undefined): LibraryTab {
  return value === "special" ? "special" : "regular";
}

function createModeOf(value: string | string[] | undefined): CreateMode {
  if (value === "import" || value === "document") return "file";
  if (value === "manual") return "manual";
  if (value === "paste") return "paste";
  if (value === "google_sheets") return "google_sheets";
  return null;
}

export default async function SetsPage({
  searchParams,
}: Readonly<{ searchParams: Promise<RouteSearchParams> }>) {
  const raw = await searchParams;
  const tab = tabOf(raw.tab);
  const createMode = createModeOf(raw.create);
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
    <main className="mx-auto w-full max-w-4xl p-3 sm:p-8">
      <h1 className="text-2xl font-bold sm:text-3xl">Bộ flashcard</h1>
      <div className="mt-2 grid gap-4 sm:mt-5 sm:grid-cols-2 sm:items-start">
        <CreateSetCard mode={createMode} searchParams={raw}>
          {createMode === "paste" ? <PasteImport /> : null}
          {createMode === "file" ? <FileImport /> : null}
          {createMode === "google_sheets" ? <GoogleSheetsImport /> : null}
          {createMode === "manual" ? <ManualSetForm /> : null}
        </CreateSetCard>
        <LibraryCard open={createMode === null}>
          {createMode === null ? (
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
          ) : null}
        </LibraryCard>
      </div>
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
  const isReordering = searchParams.reorder === "1";
  const supabase = await createClient();
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
        "/sets",
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
              href={updateSearchParamHref("/sets", searchParams, "reorder", "1")}
              scroll={false}
            >
              <ListOrdered aria-hidden="true" />
              Sắp xếp
            </Link>
          </Button>
        </div>
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
    <section
      aria-label="Đang tải nội dung bộ flashcard"
      className="mt-3 space-y-3 sm:mt-5 sm:space-y-4"
      role="status"
    >
      <div className="h-6 w-32 animate-pulse rounded-lg bg-surface-subtle sm:h-7 sm:w-40" />
      <div className="h-9 animate-pulse rounded-xl bg-surface-subtle sm:h-11 sm:max-w-sm" />
      <div className="h-24 animate-pulse rounded-2xl bg-surface-subtle sm:h-28" />
    </section>
  );
}
