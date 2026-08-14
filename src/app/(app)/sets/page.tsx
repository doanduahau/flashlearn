import type { Metadata } from "next";
import { ClipboardPaste, FileText, FileUp, ListOrdered, Sheet, SquarePen } from "lucide-react";
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
import { PasteImport } from "@/features/imports/components/paste-import";
import { GoogleSheetsImport } from "@/features/imports/components/google-sheets-import";
import { DocumentImport } from "@/features/imports/components/document-import";
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
type CreateMode = "import" | "manual" | "paste" | "google_sheets" | "document" | null;

function tabOf(value: string | string[] | undefined): LibraryTab {
  return value === "special" ? "special" : "regular";
}

function createModeOf(value: string | string[] | undefined): CreateMode {
  if (
    value === "import" ||
    value === "manual" ||
    value === "paste" ||
    value === "google_sheets" ||
    value === "document"
  )
    return value;
  return null;
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
    <main className="mx-auto w-full max-w-4xl p-3 sm:p-8">
      <h1 className="text-2xl font-bold sm:text-3xl">Bộ flashcard</h1>
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
  const pasteHref = updateSearchParamHref("/sets", searchParams, "create", "paste");
  const sheetsHref = updateSearchParamHref("/sets", searchParams, "create", "google_sheets");
  const documentHref = updateSearchParamHref("/sets", searchParams, "create", "document");
  const closeHref = removeSearchParamHref("/sets", searchParams, "create");

  return (
    <section
      aria-label="Tạo bộ flashcard"
      className="mt-2 rounded-xl border border-border-soft bg-surface-subtle p-2 sm:mt-5 sm:rounded-2xl sm:p-4"
    >
      {mode === null ? (
        <div className="flex flex-col items-center gap-1 sm:gap-2">
          <span className="text-sm font-semibold text-text-secondary sm:text-base">Tạo bộ</span>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <Button asChild size="sm" className="min-h-9 flex-1 sm:min-h-10 sm:flex-none">
              <Link href={importHref} scroll={false}>
                <FileUp aria-hidden="true" />
                Nhập Excel
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="min-h-9 flex-1 sm:min-h-10 sm:flex-none"
            >
              <Link href={pasteHref} scroll={false}>
                <ClipboardPaste aria-hidden="true" />
                Dán nội dung
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="min-h-9 flex-1 sm:min-h-10 sm:flex-none"
            >
              <Link href={sheetsHref} scroll={false}>
                <Sheet aria-hidden="true" />
                Google Sheets
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="min-h-9 flex-1 sm:min-h-10 sm:flex-none"
            >
              <Link href={documentHref} scroll={false}>
                <FileText aria-hidden="true" />
                Tài liệu
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="min-h-9 flex-1 sm:min-h-10 sm:flex-none"
            >
              <Link href={manualHref} scroll={false}>
                <SquarePen aria-hidden="true" />
                Thủ công
              </Link>
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-text-secondary sm:text-base">Tạo bộ</span>
            <Link className="text-sm underline" href={closeHref} scroll={false}>
              Đóng
            </Link>
          </div>
          {mode === "import" ? (
            <section
              aria-label="Nhập từ tệp"
              className="mt-3 rounded-xl border border-border-soft bg-surface p-3 sm:rounded-2xl sm:p-5"
            >
              <ImportWizard />
            </section>
          ) : null}
          {mode === "manual" ? <ManualSetForm /> : null}
          {mode === "paste" ? (
            <section
              aria-label="Dán nội dung"
              className="mt-3 rounded-xl border border-border-soft bg-surface p-3 sm:rounded-2xl sm:p-5"
            >
              <PasteImport />
            </section>
          ) : null}
          {mode === "google_sheets" ? (
            <section
              aria-label="Google Sheets"
              className="mt-3 rounded-xl border border-border-soft bg-surface p-3 sm:rounded-2xl sm:p-5"
            >
              <GoogleSheetsImport />
            </section>
          ) : null}
          {mode === "document" ? (
            <section
              aria-label="Tài liệu"
              className="mt-3 rounded-xl border border-border-soft bg-surface p-3 sm:rounded-2xl sm:p-5"
            >
              <DocumentImport />
            </section>
          ) : null}
        </>
      )}
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
          <h2 className="text-base font-semibold sm:text-lg">Bộ thường</h2>
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
        <h2 className="text-base font-semibold sm:text-lg">Bộ đặc biệt</h2>
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
