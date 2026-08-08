import type { Metadata } from "next";
import { FileUp, ListOrdered, SquarePen } from "lucide-react";
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
import { ImportWizard } from "@/features/imports/components/import-wizard";
import {
  CollectionsList,
  type CollectionSummary,
} from "@/features/special-collections/components/collections-list";
import { CreateCollectionToggle } from "@/features/special-collections/components/create-collection-toggle";
import { LIBRARY_PAGE_SIZE } from "@/lib/constants";
import {
  pageHref,
  parsePage,
  removeSearchParamHref,
  type RouteSearchParams,
  updateSearchParamHref,
} from "@/lib/pagination";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Bộ flashcard" };

type LibraryTab = "regular" | "special";
type CreateMode = "import" | "manual" | null;

function tabOf(value: string | string[] | undefined): LibraryTab {
  return value === "special" ? "special" : "regular";
}

function createModeOf(value: string | string[] | undefined): CreateMode {
  return value === "import" || value === "manual" ? value : null;
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
      <CreateSetBlock mode={createModeOf(raw.create)} searchParams={raw} />
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

function CreateSetBlock({
  mode,
  searchParams,
}: Readonly<{ mode: CreateMode; searchParams: RouteSearchParams }>) {
  const importHref = updateSearchParamHref("/sets", searchParams, "create", "import");
  const manualHref = updateSearchParamHref("/sets", searchParams, "create", "manual");
  const closeHref = removeSearchParamHref("/sets", searchParams, "create");

  return (
    <section
      aria-label="Tạo bộ flashcard"
      className="mt-6 rounded-2xl border border-border-soft bg-surface-subtle p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">Tạo bộ flashcard</h2>
        {mode === null ? (
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" className="min-h-11">
              <Link href={importHref} scroll={false}>
                <FileUp aria-hidden="true" />
                Nhập từ tệp
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="min-h-11">
              <Link href={manualHref} scroll={false}>
                <SquarePen aria-hidden="true" />
                Tạo bộ thủ công
              </Link>
            </Button>
          </div>
        ) : (
          <Link className="text-sm underline" href={closeHref} scroll={false}>
            Đóng
          </Link>
        )}
      </div>
      {mode === "import" ? (
        <section
          aria-label="Nhập từ tệp"
          className="mt-4 rounded-2xl border border-border-soft bg-surface p-5"
        >
          <ImportWizard />
        </section>
      ) : null}
      {mode === "manual" ? <ManualSetForm /> : null}
    </section>
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
      .order("sort_order", { ascending: true })
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
      <section className="mt-6" aria-label="Danh sách bộ thường">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold">Bộ thường</h2>
          <Button asChild variant="outline" size="sm" className="min-h-11">
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
    <section className="mt-6" aria-label="Danh sách bộ đặc biệt">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Bộ đặc biệt</h2>
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
    <section aria-label="Đang tải nội dung bộ flashcard" className="mt-6 space-y-4" role="status">
      <div className="h-7 w-40 animate-pulse rounded-lg bg-surface-subtle" />
      <div className="h-11 max-w-sm animate-pulse rounded-xl bg-surface-subtle" />
      <div className="h-28 animate-pulse rounded-2xl bg-surface-subtle" />
    </section>
  );
}
